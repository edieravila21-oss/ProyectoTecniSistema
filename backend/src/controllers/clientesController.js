const prisma = require('../config/db');
const { paginar, respuestaPaginada } = require('../utils/helpers');

const listar = async (req, res, next) => {
  try {
    const { buscar, page = 1, limit = 20 } = req.query;
    const where = buscar
      ? { OR: [{ nombre: { contains: buscar, mode: 'insensitive' } }, { telefono: { contains: buscar } }] }
      : {};

    const [clientes, total] = await Promise.all([
      prisma.cliente.findMany({
        where,
        include: {
          _count: { select: { servicios: true } },
          servicios: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true, valor_final: true } },
          equipos: { select: { id: true, tipo: true, marca: true, modelo: true } },
        },
        orderBy: { nombre: 'asc' },
        ...paginar(page, limit),
      }),
      prisma.cliente.count({ where }),
    ]);

    const data = clientes.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      telefono: c.telefono,
      email: c.email,
      direccion_principal: c.direccion_principal,
      total_servicios: c._count.servicios,
      ultimo_servicio: c.servicios[0]?.createdAt || null,
      equipos: c.equipos,
      createdAt: c.createdAt,
    }));

    res.json({ success: true, ...respuestaPaginada(data, total, page, limit) });
  } catch (error) {
    next(error);
  }
};

const obtener = async (req, res, next) => {
  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id: req.params.id },
      include: {
        equipos: true,
        servicios: {
          include: { tecnico: { select: { id: true, nombre: true } }, equipo: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!cliente) {
      return res.status(404).json({ success: false, error: 'Cliente no encontrado', code: 'NOT_FOUND' });
    }

    const totalGastado = await prisma.servicio.aggregate({
      where: { clienteId: req.params.id, estado: 'completado' },
      _sum: { valor_final: true },
    });

    res.json({
      success: true,
      data: { ...cliente, total_gastado: totalGastado._sum.valor_final || 0 },
    });
  } catch (error) {
    next(error);
  }
};

const crear = async (req, res, next) => {
  try {
    const { nombre, telefono, email, direccion_principal, notas } = req.body;

    if (!nombre || !telefono) {
      return res.status(400).json({ success: false, error: 'Nombre y teléfono son requeridos', code: 'VALIDATION_ERROR' });
    }

    const existente = await prisma.cliente.findUnique({ where: { telefono } });
    if (existente) {
      return res.status(409).json({ success: false, error: 'Ya existe un cliente con ese teléfono', code: 'DUPLICATE' });
    }

    const cliente = await prisma.cliente.create({
      data: { nombre, telefono, email, direccion_principal, notas },
    });

    res.status(201).json({ success: true, data: cliente });
  } catch (error) {
    next(error);
  }
};

const actualizar = async (req, res, next) => {
  try {
    const { nombre, telefono, email, direccion_principal, notas } = req.body;

    const cliente = await prisma.cliente.update({
      where: { id: req.params.id },
      data: { nombre, telefono, email, direccion_principal, notas },
    });

    res.json({ success: true, data: cliente });
  } catch (error) {
    next(error);
  }
};

const listarEquipos = async (req, res, next) => {
  try {
    const equipos = await prisma.equipo.findMany({
      where: { clienteId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: equipos });
  } catch (error) {
    next(error);
  }
};

const crearEquipo = async (req, res, next) => {
  try {
    const { tipo, marca, modelo, serial, notas } = req.body;

    if (!tipo) {
      return res.status(400).json({ success: false, error: 'El tipo de equipo es requerido', code: 'VALIDATION_ERROR' });
    }

    const equipo = await prisma.equipo.create({
      data: { clienteId: req.params.id, tipo, marca, modelo, serial, notas },
    });

    res.status(201).json({ success: true, data: equipo });
  } catch (error) {
    next(error);
  }
};

const historialCliente = async (req, res, next) => {
  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, nombre: true, telefono: true, email: true,
        direccion_principal: true, notas: true, createdAt: true,
      },
    });

    if (!cliente) {
      return res.status(404).json({ success: false, error: 'Cliente no encontrado', code: 'NOT_FOUND' });
    }

    const servicios = await prisma.servicio.findMany({
      where: { clienteId: req.params.id },
      select: {
        id: true, estado: true, descripcion_falla: true, notas_tecnico: true,
        notas_admin: true, origen: true,
        fecha_programada: true, fecha_fin_real: true, valor_final: true,
        calificacion_cliente: true, hora_inicio: true, direccion_servicio: true,
        tecnico: { select: { id: true, nombre: true } },
        equipo: { select: { id: true, tipo: true, marca: true, modelo: true } },
        fotos: { select: { id: true, url: true, tipo: true, subida_at: true }, orderBy: { subida_at: 'asc' } },
        firma: { select: { url: true } },
      },
      orderBy: { fecha_programada: 'desc' },
      take: 20,
    });

    const equipos = await prisma.equipo.findMany({
      where: { clienteId: req.params.id },
      select: { id: true, tipo: true, marca: true, modelo: true, serial: true },
    });

    const stats = await prisma.servicio.aggregate({
      where: { clienteId: req.params.id, estado: 'completado' },
      _sum: { valor_final: true },
      _count: { id: true },
      _avg: { calificacion_cliente: true },
    });

    const proximoRecordatorio = await prisma.recordatorioMantenimiento.findFirst({
      where: { clienteId: req.params.id, enviado: false },
      orderBy: { fecha_proximo_recordatorio: 'asc' },
      include: { equipo: { select: { tipo: true, marca: true, modelo: true } } },
    });

    res.json({
      success: true,
      data: {
        cliente,
        servicios,
        equipos,
        stats: {
          total_servicios: stats._count.id,
          total_gastado: stats._sum.valor_final || 0,
          calificacion_promedio: stats._avg.calificacion_cliente || 0,
        },
        proximo_recordatorio: proximoRecordatorio,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { listar, obtener, crear, actualizar, listarEquipos, crearEquipo, historialCliente };
