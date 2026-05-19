const prisma = require('../config/db');

const obtener = async (req, res, next) => {
  try {
    let config = await prisma.configuracion.findFirst();
    if (!config) {
      config = await prisma.configuracion.create({ data: {} });
    }
    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
};

const actualizar = async (req, res, next) => {
  try {
    let config = await prisma.configuracion.findFirst();
    if (!config) {
      config = await prisma.configuracion.create({ data: {} });
    }

    const actualizada = await prisma.configuracion.update({
      where: { id: config.id },
      data: req.body,
    });

    res.json({ success: true, data: actualizada });
  } catch (error) {
    next(error);
  }
};

module.exports = { obtener, actualizar };
