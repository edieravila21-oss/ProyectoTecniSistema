const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { enviarEmail } = require('../config/mailer');
const { paginar, respuestaPaginada } = require('../utils/helpers');

const listar = async (req, res, next) => {
  try {
    const { rol, activo, page = 1, limit = 20 } = req.query;
    const where = {};
    if (rol) where.rol = rol;
    if (activo !== undefined) where.activo = activo === 'true';

    const [usuarios, total] = await Promise.all([
      prisma.usuario.findMany({
        where,
        select: { id: true, nombre: true, email: true, rol: true, telefono: true, foto_url: true, activo: true, especialidad: true, createdAt: true },
        orderBy: { nombre: 'asc' },
        ...paginar(page, limit),
      }),
      prisma.usuario.count({ where }),
    ]);

    res.json({ success: true, ...respuestaPaginada(usuarios, total, page, limit) });
  } catch (error) {
    next(error);
  }
};

const obtener = async (req, res, next) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.params.id },
      select: { id: true, nombre: true, email: true, rol: true, telefono: true, foto_url: true, activo: true, especialidad: true, createdAt: true },
    });

    if (!usuario) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado', code: 'NOT_FOUND' });
    }

    const stats = await prisma.servicio.aggregate({
      where: { tecnicoId: req.params.id },
      _count: true,
      _avg: { calificacion_cliente: true },
    });

    const completados = await prisma.servicio.count({
      where: { tecnicoId: req.params.id, estado: 'completado' },
    });

    res.json({
      success: true,
      data: {
        ...usuario,
        estadisticas: {
          total_servicios: stats._count,
          completados,
          calificacion_promedio: stats._avg.calificacion_cliente || 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const crear = async (req, res, next) => {
  try {
    const { nombre, email, pin, telefono, especialidad, foto_url } = req.body;

    if (!nombre || !email || !pin) {
      return res.status(400).json({ success: false, error: 'Nombre, email y PIN son requeridos', code: 'VALIDATION_ERROR' });
    }

    const pinStr = String(pin).trim();
    if (!/^\d{4,6}$/.test(pinStr)) {
      return res.status(400).json({ success: false, error: 'El PIN debe ser un código numérico de 4 a 6 dígitos', code: 'VALIDATION_ERROR' });
    }

    const hashedPin = await bcrypt.hash(pinStr, 10);

    const usuario = await prisma.usuario.create({
      data: {
        nombre,
        email,
        password: hashedPin,
        rol: 'tecnico',
        telefono,
        especialidad: especialidad || 'ambos',
        foto_url,
      },
      select: { id: true, nombre: true, email: true, rol: true, telefono: true, foto_url: true, activo: true, especialidad: true },
    });

    await enviarEmail({
      to: email,
      subject: `Bienvenido a ${process.env.NOMBRE_NEGOCIO || 'RefriElectri Pro'}`,
      html: `<p>Hola ${nombre},</p>
      <p>Tu cuenta de técnico ha sido creada.</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>PIN de acceso:</strong> ${pinStr}</p>
      <p>Por favor, cambia tu PIN después del primer inicio de sesión.</p>`,
    });

    res.status(201).json({ success: true, data: usuario });
  } catch (error) {
    next(error);
  }
};

const actualizar = async (req, res, next) => {
  try {
    const { nombre, email, telefono, especialidad, foto_url } = req.body;

    const usuario = await prisma.usuario.update({
      where: { id: req.params.id },
      data: { nombre, email, telefono, especialidad, foto_url },
      select: { id: true, nombre: true, email: true, rol: true, telefono: true, foto_url: true, activo: true, especialidad: true },
    });

    res.json({ success: true, data: usuario });
  } catch (error) {
    next(error);
  }
};

const toggleActivo = async (req, res, next) => {
  try {
    const usuario = await prisma.usuario.findUnique({ where: { id: req.params.id } });
    if (!usuario) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado', code: 'NOT_FOUND' });
    }

    const actualizado = await prisma.usuario.update({
      where: { id: req.params.id },
      data: { activo: !usuario.activo },
      select: { id: true, nombre: true, activo: true },
    });

    res.json({ success: true, data: actualizado });
  } catch (error) {
    next(error);
  }
};

const agenda = async (req, res, next) => {
  try {
    const { fecha } = req.query;
    const startOfDay = new Date(fecha);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(fecha);
    endOfDay.setHours(23, 59, 59, 999);

    const servicios = await prisma.servicio.findMany({
      where: {
        tecnicoId: req.params.id,
        fecha_programada: { gte: startOfDay, lte: endOfDay },
      },
      include: { cliente: true, equipo: true },
      orderBy: { hora_inicio: 'asc' },
    });

    res.json({ success: true, data: servicios });
  } catch (error) {
    next(error);
  }
};

const metricas = async (req, res, next) => {
  try {
    const { desde, hasta } = req.query;
    const where = {
      tecnicoId: req.params.id,
      ...(desde && hasta ? { fecha_programada: { gte: new Date(desde), lte: new Date(hasta) } } : {}),
    };

    const [total, completados, cancelados] = await Promise.all([
      prisma.servicio.count({ where }),
      prisma.servicio.count({ where: { ...where, estado: 'completado' } }),
      prisma.servicio.count({ where: { ...where, estado: 'cancelado' } }),
    ]);

    const stats = await prisma.servicio.aggregate({
      where: { ...where, estado: 'completado' },
      _avg: { calificacion_cliente: true, valor_final: true },
      _sum: { valor_final: true },
    });

    res.json({
      success: true,
      data: {
        total_servicios: total,
        completados,
        cancelados,
        calificacion_promedio: stats._avg.calificacion_cliente || 0,
        ingresos_generados: stats._sum.valor_final || 0,
        valor_promedio: stats._avg.valor_final || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { listar, obtener, crear, actualizar, toggleActivo, agenda, metricas };
