const prisma = require('../config/db');

const listar = async (req, res, next) => {
  try {
    const { tecnicoId } = req.query;
    const where = {};
    if (tecnicoId) where.tecnicoId = tecnicoId;

    const evaluaciones = await prisma.evaluacion.findMany({
      where,
      orderBy: { fecha: 'desc' },
    });

    res.json({ success: true, data: evaluaciones });
  } catch (error) {
    next(error);
  }
};

const crear = async (req, res, next) => {
  try {
    const { tecnicoId, conocimiento, servicio, promedio_k, promedio_s, analisis } = req.body;

    if (!tecnicoId) {
      return res.status(400).json({ success: false, error: 'tecnicoId es requerido' });
    }

    const evaluacion = await prisma.evaluacion.create({
      data: {
        tecnicoId,
        conocimiento,
        servicio,
        promedio_k,
        promedio_s,
        analisis,
      },
    });

    res.status(201).json({ success: true, data: evaluacion });
  } catch (error) {
    next(error);
  }
};

const obtener = async (req, res, next) => {
  try {
    const evaluacion = await prisma.evaluacion.findUnique({
      where: { id: req.params.id },
    });

    if (!evaluacion) {
      return res.status(404).json({ success: false, error: 'Evaluación no encontrada' });
    }

    res.json({ success: true, data: evaluacion });
  } catch (error) {
    next(error);
  }
};

const eliminar = async (req, res, next) => {
  try {
    await prisma.evaluacion.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true, message: 'Evaluación eliminada' });
  } catch (error) {
    next(error);
  }
};

module.exports = { listar, crear, obtener, eliminar };
