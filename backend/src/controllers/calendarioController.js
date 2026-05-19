const prisma = require('../config/db');
const { getIO } = require('../config/socket');
const { paginar, respuestaPaginada } = require('../utils/helpers');

const listar = async (req, res, next) => {
  try {
    const { tecnico_id, desde, hasta, fecha, page = 1, limit = 100 } = req.query;
    const where = {};

    if (tecnico_id) where.tecnicoId = tecnico_id;

    if (fecha) {
      where.fecha = new Date(fecha);
    } else if (desde && hasta) {
      where.fecha = { gte: new Date(desde), lte: new Date(hasta) };
    }

    const [eventos, total] = await Promise.all([
      prisma.eventoCalendario.findMany({
        where,
        include: {
          tecnico: { select: { id: true, nombre: true, foto_url: true } },
          creadoPor: { select: { id: true, nombre: true, rol: true } },
        },
        orderBy: [{ fecha: 'asc' }, { hora_inicio: 'asc' }],
        ...paginar(page, limit),
      }),
      prisma.eventoCalendario.count({ where }),
    ]);

    res.json({ success: true, ...respuestaPaginada(eventos, total, page, limit) });
  } catch (error) {
    next(error);
  }
};

const crear = async (req, res, next) => {
  try {
    const { tecnicoId, titulo, descripcion, fecha, hora_inicio, hora_fin, tipo, todo_el_dia } = req.body;

    if (!tecnicoId || !titulo || !fecha || !hora_inicio || !hora_fin) {
      return res.status(400).json({ success: false, error: 'Faltan campos obligatorios (tecnicoId, titulo, fecha, hora_inicio, hora_fin)' });
    }

    const tecnico = await prisma.usuario.findUnique({ where: { id: tecnicoId } });
    if (!tecnico || tecnico.rol !== 'tecnico') {
      return res.status(404).json({ success: false, error: 'Técnico no encontrado' });
    }

    const evento = await prisma.eventoCalendario.create({
      data: {
        tecnicoId,
        titulo,
        descripcion: descripcion || null,
        fecha: new Date(fecha),
        hora_inicio,
        hora_fin,
        tipo: tipo || 'personal',
        todo_el_dia: todo_el_dia || false,
        creadoPorId: req.usuario.id,
      },
      include: {
        tecnico: { select: { id: true, nombre: true, foto_url: true } },
        creadoPor: { select: { id: true, nombre: true, rol: true } },
      },
    });

    try {
      getIO().to('admin').emit('evento_calendario_creado', evento);
      getIO().to(`tecnico_${tecnicoId}`).emit('evento_calendario_creado', evento);
    } catch (_) {}

    res.status(201).json({ success: true, data: evento });
  } catch (error) {
    next(error);
  }
};

const actualizar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { titulo, descripcion, fecha, hora_inicio, hora_fin, tipo, todo_el_dia } = req.body;

    const existing = await prisma.eventoCalendario.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Evento no encontrado' });
    }

    const data = {};
    if (titulo !== undefined) data.titulo = titulo;
    if (descripcion !== undefined) data.descripcion = descripcion;
    if (fecha !== undefined) data.fecha = new Date(fecha);
    if (hora_inicio !== undefined) data.hora_inicio = hora_inicio;
    if (hora_fin !== undefined) data.hora_fin = hora_fin;
    if (tipo !== undefined) data.tipo = tipo;
    if (todo_el_dia !== undefined) data.todo_el_dia = todo_el_dia;

    const evento = await prisma.eventoCalendario.update({
      where: { id },
      data,
      include: {
        tecnico: { select: { id: true, nombre: true, foto_url: true } },
        creadoPor: { select: { id: true, nombre: true, rol: true } },
      },
    });

    try {
      getIO().to('admin').emit('evento_calendario_actualizado', evento);
      getIO().to(`tecnico_${evento.tecnicoId}`).emit('evento_calendario_actualizado', evento);
    } catch (_) {}

    res.json({ success: true, data: evento });
  } catch (error) {
    next(error);
  }
};

const eliminar = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.eventoCalendario.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Evento no encontrado' });
    }

    await prisma.eventoCalendario.delete({ where: { id } });

    try {
      getIO().to('admin').emit('evento_calendario_eliminado', { id, tecnicoId: existing.tecnicoId });
      getIO().to(`tecnico_${existing.tecnicoId}`).emit('evento_calendario_eliminado', { id });
    } catch (_) {}

    res.json({ success: true, data: { id } });
  } catch (error) {
    next(error);
  }
};

module.exports = { listar, crear, actualizar, eliminar };
