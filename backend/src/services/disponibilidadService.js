const prisma = require('../config/db');

const SLOTS = [
  { label: '8:00 AM a 12:00 PM', hora_inicio: '08:00', hora_fin: '12:00' },
  { label: '1:00 PM a 5:00 PM', hora_inicio: '13:00', hora_fin: '17:00' },
];

const especialidadParaTipo = (tipoEquipo) => {
  if (tipoEquipo === 'nevera') return ['neveras', 'ambos'];
  if (tipoEquipo === 'aire_acondicionado') return ['aires', 'ambos'];
  return ['aires', 'neveras', 'ambos'];
};

const obtenerDisponibilidad = async (tipoEquipo, diasAdelante = 7, maxOpciones = 4) => {
  const especialidades = especialidadParaTipo(tipoEquipo);

  const tecnicos = await prisma.usuario.findMany({
    where: {
      rol: 'tecnico',
      activo: true,
      especialidad: { in: especialidades },
    },
    select: { id: true, nombre: true, especialidad: true },
  });

  if (tecnicos.length === 0) return [];

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const fechaLimite = new Date(hoy);
  fechaLimite.setDate(fechaLimite.getDate() + diasAdelante);

  const serviciosOcupados = await prisma.servicio.findMany({
    where: {
      tecnicoId: { in: tecnicos.map(t => t.id) },
      estado: { notIn: ['completado', 'cancelado'] },
      fecha_programada: { gte: hoy, lte: fechaLimite },
    },
    select: { tecnicoId: true, fecha_programada: true, hora_inicio: true, hora_fin: true },
  });

  const ocupadoMap = new Map();
  for (const s of serviciosOcupados) {
    if (!s.fecha_programada || !s.tecnicoId) continue;
    const fechaKey = s.fecha_programada.toISOString().split('T')[0];
    const slotKey = `${s.tecnicoId}_${fechaKey}_${s.hora_inicio || '08:00'}`;
    ocupadoMap.set(slotKey, true);
  }

  const opciones = [];

  for (let d = 1; d <= diasAdelante && opciones.length < maxOpciones; d++) {
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() + d);

    if (fecha.getDay() === 0) continue;

    const fechaKey = fecha.toISOString().split('T')[0];

    for (const slot of SLOTS) {
      if (opciones.length >= maxOpciones) break;

      const tecnicoDisponible = tecnicos.find(t => {
        const slotKey = `${t.id}_${fechaKey}_${slot.hora_inicio}`;
        return !ocupadoMap.has(slotKey);
      });

      if (tecnicoDisponible) {
        const fechaObj = new Date(fecha);
        const [h, m] = slot.hora_inicio.split(':');
        fechaObj.setHours(parseInt(h), parseInt(m), 0, 0);

        opciones.push({
          fecha: fechaObj,
          fechaKey,
          hora_inicio: slot.hora_inicio,
          hora_fin: slot.hora_fin,
          label: slot.label,
          diaLabel: fecha.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }),
          tecnico: tecnicoDisponible,
        });
      }
    }
  }

  return opciones;
};

const asignarTecnicoParaSlot = async (tipoEquipo, fechaKey, horaInicio) => {
  const especialidades = especialidadParaTipo(tipoEquipo);

  const tecnicos = await prisma.usuario.findMany({
    where: {
      rol: 'tecnico',
      activo: true,
      especialidad: { in: especialidades },
    },
    select: { id: true, nombre: true },
  });

  if (tecnicos.length === 0) return null;

  const fechaInicio = new Date(fechaKey);
  fechaInicio.setHours(0, 0, 0, 0);
  const fechaFin = new Date(fechaKey);
  fechaFin.setHours(23, 59, 59, 999);

  const serviciosDelDia = await prisma.servicio.findMany({
    where: {
      tecnicoId: { in: tecnicos.map(t => t.id) },
      estado: { notIn: ['completado', 'cancelado'] },
      fecha_programada: { gte: fechaInicio, lte: fechaFin },
      hora_inicio: horaInicio,
    },
    select: { tecnicoId: true },
  });

  const ocupados = new Set(serviciosDelDia.map(s => s.tecnicoId));

  const cargaPorTecnico = await prisma.servicio.groupBy({
    by: ['tecnicoId'],
    where: {
      tecnicoId: { in: tecnicos.filter(t => !ocupados.has(t.id)).map(t => t.id) },
      estado: { notIn: ['completado', 'cancelado'] },
      fecha_programada: { gte: fechaInicio, lte: fechaFin },
    },
    _count: { id: true },
  });

  const cargaMap = new Map(cargaPorTecnico.map(c => [c.tecnicoId, c._count.id]));

  const disponibles = tecnicos
    .filter(t => !ocupados.has(t.id))
    .sort((a, b) => (cargaMap.get(a.id) || 0) - (cargaMap.get(b.id) || 0));

  return disponibles[0] || null;
};

module.exports = { obtenerDisponibilidad, asignarTecnicoParaSlot };
