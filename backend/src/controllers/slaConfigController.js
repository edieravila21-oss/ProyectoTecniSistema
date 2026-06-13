const { prisma } = require('../db');

const getAll = async (req, res, next) => {
  try {
    const configs = await prisma.configuracionSLA.findMany({
      orderBy: { tipo_servicio: 'asc' },
    });
    res.json({ success: true, data: configs });
  } catch (error) {
    next(error);
  }
};

const getByType = async (req, res, next) => {
  try {
    const { tipo_servicio } = req.params;
    const config = await prisma.configuracionSLA.findUnique({
      where: { tipo_servicio },
    });
    if (!config) {
      return res.status(404).json({ success: false, message: 'SLA configuration not found' });
    }
    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const { tipo_servicio, max_tiempo_camino_min, max_tiempo_ejecucion_min, descripcion } = req.body;

    // Validar que el tipo de servicio sea válido
    const validTypes = ['diagnostico', 'mantenimiento', 'reparacion', 'instalacion'];
    if (!validTypes.includes(tipo_servicio)) {
      return res.status(400).json({
        success: false,
        message: `Tipo de servicio inválido. Debe ser uno de: ${validTypes.join(', ')}`,
      });
    }

    // Verificar si ya existe
    const existing = await prisma.configuracionSLA.findUnique({
      where: { tipo_servicio },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe una configuración de SLA para este tipo de servicio',
      });
    }

    const config = await prisma.configuracionSLA.create({
      data: {
        tipo_servicio,
        max_tiempo_camino_min: max_tiempo_camino_min || 15,
        max_tiempo_ejecucion_min: max_tiempo_ejecucion_min || 60,
        descripcion: descripcion || null,
        activo: true,
      },
    });

    res.status(201).json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { tipo_servicio } = req.params;
    const { max_tiempo_camino_min, max_tiempo_ejecucion_min, descripcion, activo } = req.body;

    const existing = await prisma.configuracionSLA.findUnique({
      where: { tipo_servicio },
    });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'SLA configuration not found',
      });
    }

    const config = await prisma.configuracionSLA.update({
      where: { tipo_servicio },
      data: {
        ...(max_tiempo_camino_min !== undefined && { max_tiempo_camino_min }),
        ...(max_tiempo_ejecucion_min !== undefined && { max_tiempo_ejecucion_min }),
        ...(descripcion !== undefined && { descripcion }),
        ...(activo !== undefined && { activo }),
      },
    });

    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
};

const deactivate = async (req, res, next) => {
  try {
    const { tipo_servicio } = req.params;

    const existing = await prisma.configuracionSLA.findUnique({
      where: { tipo_servicio },
    });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'SLA configuration not found',
      });
    }

    const config = await prisma.configuracionSLA.update({
      where: { tipo_servicio },
      data: { activo: false },
    });

    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAll, getByType, create, update, deactivate };
