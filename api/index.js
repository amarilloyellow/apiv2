import express from 'express';
import { createClient } from '@vercel/kv';
import { nanoid } from 'nanoid';

// Asegúrate de que las variables de entorno están presentes
if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
  throw new Error('KV environment variables are not set');
}

// Inicializar Express App
const app = express();
app.use(express.json());

// Conectar a Vercel KV usando createClient
const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// --- CLAVES PARA LOS ÍNDICES ---
const CARRERAS_INDEX_KEY = 'idx:carreras';
const ASIGNATURAS_INDEX_KEY = 'idx:asignaturas';

// --- FUNCIÓN AUXILIAR PARA OBTENER DATOS ---
async function getAllFromIndex(indexKey) {
  try {
    const keys = await kv.smembers(indexKey);
    if (!keys || keys.length === 0) {
      return [];
    }
    // Usar un pipeline para obtener todos los datos en una sola llamada de red
    const pipeline = kv.pipeline();
    keys.forEach(key => {
      if (key) pipeline.hgetall(key);
    });
    const results = await pipeline.exec();
    return results;
  } catch (error) {
    console.error(`Error fetching from index ${indexKey}:`, error);
    throw new Error('Failed to retrieve data from database.');
  }
}

/*
=================================================
=                RUTAS DE CARRERAS              =
=================================================
*/

// GET /api/carreras - Obtener todas las carreras
app.get('/api/carreras', async (req, res) => {
  try {
    const carreras = await getAllFromIndex(CARRERAS_INDEX_KEY);
    res.status(200).json(carreras);
  } catch (error) {
    console.error('Error en GET /api/carreras:', error);
    res.status(500).json({ error: 'Error interno del servidor al obtener carreras.' });
  }
});

// POST /api/carreras - Crear una o más carreras
app.post('/api/carreras', async (req, res) => {
  try {
    const carreras = req.body;
    if (!Array.isArray(carreras)) {
      return res.status(400).json({ error: 'El cuerpo de la petición debe ser un array de carreras.' });
    }

    const pipeline = kv.pipeline();
    for (const carrera of carreras) {
      if (carrera && carrera.codigo) {
        const key = `carrera:${carrera.codigo}`;
        pipeline.hset(key, carrera);
        pipeline.sadd(CARRERAS_INDEX_KEY, key);
      }
    }
    await pipeline.exec();
    res.status(201).json({ message: 'Carreras creadas exitosamente.' });
  } catch (error) {
    console.error('Error en POST /api/carreras:', error);
    res.status(500).json({ error: 'Error al crear carreras.' });
  }
});

// Otras rutas... (puedes agregarlas después de que esta funcione)

// Exportar la app para que Vercel la pueda usar
export default app;