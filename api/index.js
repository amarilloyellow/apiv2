import express from 'express';
import { createKysely } from '@vercel/kv';
import { nanoid } from 'nanoid';

// Inicializar Express App
const app = express();
app.use(express.json()); // Middleware para parsear JSON

// Conectar a Vercel KV
const kv = createKysely();

// --- ÍNDICES ---
// Usaremos dos sets para mantener un registro de todas las claves
const CARRERAS_INDEX_KEY = 'idx:carreras';
const ASIGNATURAS_INDEX_KEY = 'idx:asignaturas';

// Función auxiliar para obtener todos los miembros de un índice y sus datos
async function getAllFromIndex(indexKey) {
  const keys = await kv.smembers(indexKey);
  if (!keys || keys.length === 0) {
    return [];
  }
  const pipeline = kv.pipeline();
  keys.forEach(key => pipeline.hgetall(key));
  const results = await pipeline.exec();
  return results;
}


/*
=================================================
=                RUTAS DE CARRERAS              =
=================================================
*/

// 1. POST /api/carreras - Crear una o más carreras
app.post('/api/carreras', async (req, res) => {
  try {
    const carreras = req.body; // Espera un array: [{codigo, semestre}, ...]
    if (!Array.isArray(carreras)) {
      return res.status(400).json({ error: 'El cuerpo de la petición debe ser un array de carreras.' });
    }

    const pipeline = kv.pipeline();
    for (const carrera of carreras) {
      const key = `carrera:${carrera.codigo}`;
      pipeline.hset(key, carrera);
      pipeline.sadd(CARRERAS_INDEX_KEY, key);
    }
    await pipeline.exec();

    res.status(201).json({ message: 'Carreras creadas exitosamente.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al crear carreras', details: error.message });
  }
});

// 9. GET /api/carreras - Obtener todas las carreras
app.get('/api/carreras', async (req, res) => {
  try {
    const carreras = await getAllFromIndex(CARRERAS_INDEX_KEY);
    res.status(200).json(carreras);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener las carreras', details: error.message });
  }
});

// 7. PUT /api/carreras/:codigo - Actualizar una carrera
app.put('/api/carreras/:codigo', async (req, res) => {
    try {
        const { codigo } = req.params;
        const key = `carrera:${codigo}`;

        // Verificar si la carrera existe
        const existe = await kv.exists(key);
        if (!existe) {
            return res.status(404).json({ error: 'La carrera no fue encontrada.' });
        }

        await kv.hset(key, req.body);
        const carreraActualizada = await kv.hgetall(key);

        res.status(200).json(carreraActualizada);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar la carrera', details: error.message });
    }
});


/*
=================================================
=              RUTAS DE ASIGNATURAS             =
=================================================
*/

// 4. POST /api/asignaturas - Crear una nueva asignatura
app.post('/api/asignaturas', async (req, res) => {
  try {
    const { cod, asig, uc, requisitos } = req.body;
    if (!cod || !asig || uc === undefined) {
      return res.status(400).json({ error: 'Faltan campos requeridos: cod, asig, uc.' });
    }

    // Verificar que la carrera exista
    const carreraKey = `carrera:${cod}`;
    const carreraExiste = await kv.exists(carreraKey);
    if (!carreraExiste) {
        return res.status(404).json({ error: `La carrera con el código ${cod} no existe.` });
    }

    const id = nanoid(10); // Genera un ID único de 10 caracteres
    const key = `asig:${id}`;
    const nuevaAsignatura = { id, cod, asig, uc, requisitos: requisitos || [] };

    // Usamos un pipeline para eficiencia
    const pipeline = kv.pipeline();
    pipeline.hset(key, nuevaAsignatura);
    pipeline.sadd(ASIGNATURAS_INDEX_KEY, key);
    
    // También creamos un índice por carrera para buscar asignaturas fácilmente
    pipeline.sadd(`carrera:${cod}:asignaturas`, key);

    await pipeline.exec();

    res.status(201).json(nuevaAsignatura);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear la asignatura', details: error.message });
  }
});


// 6. GET /api/asignaturas - Obtener todas las asignaturas
app.get('/api/asignaturas', async (req, res) => {
    try {
      const asignaturas = await getAllFromIndex(ASIGNATURAS_INDEX_KEY);
      res.status(200).json(asignaturas);
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener las asignaturas', details: error.message });
    }
});


// 8. GET /api/carreras/:codigo/asignaturas - Obtener todas las asignaturas de una carrera
app.get('/api/carreras/:codigo/asignaturas', async (req, res) => {
    try {
        const { codigo } = req.params;
        const indexKeyPorCarrera = `carrera:${codigo}:asignaturas`;

        const asignaturas = await getAllFromIndex(indexKeyPorCarrera);
        res.status(200).json(asignaturas);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener las asignaturas de la carrera', details: error.message });
    }
});


// 5. PUT /api/asignaturas/:id - Actualizar una asignatura
app.put('/api/asignaturas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const key = `asig:${id}`;

        const existe = await kv.exists(key);
        if (!existe) {
            return res.status(404).json({ error: 'La asignatura no fue encontrada.' });
        }

        // No permitimos cambiar el ID o el código de carrera en una actualización
        const datosActualizar = { ...req.body };
        delete datosActualizar.id;
        delete datosActualizar.cod;
        
        await kv.hset(key, datosActualizar);
        const asignaturaActualizada = await kv.hgetall(key);

        res.status(200).json(asignaturaActualizada);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar la asignatura', details: error.message });
    }
});


// Exportar la app para que Vercel la pueda usar
export default app;