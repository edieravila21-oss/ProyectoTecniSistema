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

// GET /api/calendario/disponibilidad?tecnico_id=X&fecha=YYYY-MM-DD&tipo_servicio=Z
// Retorna slots disponibles del día para el técnico, respetando horario laboral,
// servicios ya asignados y bloqueos de EventoCalendario.
const disponibilidad = async (req, res, next) => {
  try {
    const { tecnico_id, fecha, tipo_servicio } = req.query;

    if (!tecnico_id || !fecha) {
      return res.status(400).json({ success: false, error: 'tecnico_id y fecha son requeridos' });
    }

    const [config, slaConfig] = await Promise.all([
      prisma.configuracion.findFirst(),
      tipo_servicio
        ? prisma.configuracionSLA.findUnique({ where: { tipo_servicio } })
        : Promise.resolve(null),
    ]);

    const workStart = config?.hora_inicio || '07:00';
    const workEnd = config?.hora_fin || '20:00';
    const duracion = slaConfig?.max_tiempo_ejecucion_min || 60;

    const fechaObj = new Date(fecha);
    const startOfDay = new Date(fechaObj); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(fechaObj); endOfDay.setHours(23, 59, 59, 999);

    const [eventos, servicios] = await Promise.all([
      prisma.eventoCalendario.findMany({
        where: { tecnicoId: tecnico_id, fecha: { gte: startOfDay, lte: endOfDay } },
        select: { titulo: true, hora_inicio: true, hora_fin: true, tipo: true, todo_el_dia: true },
      }),
      prisma.servicio.findMany({
        where: {
          tecnicoId: tecnico_id,
          fecha_programada: { gte: startOfDay, lte: endOfDay },
          estado: { notIn: ['cancelado'] },
        },
        select: { id: true, hora_inicio: true, hora_fin: true, tipo_servicio: true, estado: true, descripcion_falla: true },
      }),
    ]);

    const todoDia = eventos.some(e => e.todo_el_dia);
    if (todoDia) {
      const bloqueo = eventos.find(e => e.todo_el_dia);
      return res.json({
        success: true,
        data: {
          disponible: false,
          motivo: `Técnico bloqueado todo el día: ${bloqueo.titulo}`,
          slots: [],
          bloqueados: [],
          duracion_minutos: duracion,
          horario_laboral: { inicio: workStart, fin: workEnd },
        },
      });
    }

    // Construir lista de intervalos ocupados
    const ocupados = [
      ...eventos.map(e => ({ inicio: e.hora_inicio, fin: e.hora_fin, tipo: 'bloqueo', titulo: e.titulo })),
      ...servicios
        .filter(s => s.hora_inicio && s.hora_fin)
        .map(s => ({ inicio: s.hora_inicio, fin: s.hora_fin, tipo: 'servicio', id: s.id, estado: s.estado })),
    ];

    // Generar slots cada 30 min dentro del horario laboral
    const [wsh, wsm] = workStart.split(':').map(Number);
    const [weh, wem] = workEnd.split(':').map(Number);
    const workStartMin = wsh * 60 + wsm;
    const workEndMin = weh * 60 + wem;

    const slots = [];
    for (let start = workStartMin; start + duracion <= workEndMin; start += 30) {
      const end = start + duracion;
      const horaInicio = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`;
      const horaFin = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
      const conflicto = ocupados.find(o => horaInicio < o.fin && horaFin > o.inicio) || null;
      slots.push({ hora_inicio: horaInicio, hora_fin: horaFin, disponible: !conflicto, conflicto });
    }

    return res.json({
      success: true,
      data: {
        disponible: slots.some(s => s.disponible),
        slots,
        ocupados,
        duracion_minutos: duracion,
        horario_laboral: { inicio: workStart, fin: workEnd },
        tipo_servicio: tipo_servicio || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/calendario/bulk — crea múltiples eventos en una sola transacción
const bulk = async (req, res, next) => {
  try {
    const { eventos } = req.body;
    if (!Array.isArray(eventos) || eventos.length === 0) {
      return res.status(400).json({ success: false, error: 'Se requiere un array de eventos' });
    }
    if (eventos.length > 3000) {
      return res.status(400).json({ success: false, error: 'Máximo 3000 eventos por solicitud' });
    }
    const result = await prisma.eventoCalendario.createMany({
      data: eventos.map(e => ({
        tecnicoId: e.tecnicoId,
        titulo: e.titulo,
        descripcion: e.descripcion || null,
        fecha: new Date(e.fecha),
        hora_inicio: e.hora_inicio,
        hora_fin: e.hora_fin,
        tipo: e.tipo || 'personal',
        todo_el_dia: e.todo_el_dia || false,
        creadoPorId: req.usuario.id,
      })),
    });
    try { getIO().to('admin').emit('eventos_calendario_bulk', { count: result.count }); } catch (_) {}
    res.status(201).json({ success: true, data: { count: result.count } });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/calendario/duplicados — admin only, removes duplicate events keeping newest per technician/day/titulo/tipo
const limpiarDuplicados = async (req, res, next) => {
  try {
    if (req.usuario.rol !== 'admin') {
      return res.status(403).json({ success: false, error: 'Solo admin puede ejecutar esta acción' });
    }

    // Find all events grouped by tecnicoId + date + titulo + tipo
    const todos = await prisma.eventoCalendario.findMany({ orderBy: { createdAt: 'desc' } });

    const vistos = new Map();
    const aEliminar = [];

    for (const ev of todos) {
      const fecha = String(ev.fecha).substring(0, 10);
      const clave = `${ev.tecnicoId}|${fecha}|${ev.titulo}|${ev.tipo}`;
      if (vistos.has(clave)) {
        aEliminar.push(ev.id);
      } else {
        vistos.set(clave, ev.id);
      }
    }

    if (aEliminar.length === 0) {
      return res.json({ success: true, eliminados: 0, message: 'No hay duplicados' });
    }

    const { count } = await prisma.eventoCalendario.deleteMany({ where: { id: { in: aEliminar } } });
    res.json({ success: true, eliminados: count, message: `Se eliminaron ${count} registros duplicados` });
  } catch (error) {
    next(error);
  }
};

module.exports = { listar, crear, actualizar, eliminar, disponibilidad, bulk, limpiarDuplicados };
