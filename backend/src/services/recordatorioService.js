const prisma = require('../config/db');

const INTERVALO_HORAS = 24;

const verificarRecordatorios = async () => {
  try {
    const hoy = new Date();
    const pendientes = await prisma.recordatorioMantenimiento.findMany({
      where: {
        enviado: false,
        fecha_proximo_recordatorio: { lte: hoy },
      },
      include: {
        cliente: { select: { nombre: true, telefono: true } },
        equipo: { select: { tipo: true, marca: true, modelo: true } },
      },
    });

    if (pendientes.length === 0) return;

    const { enviarMensaje } = require('../whatsapp/bot');
    const tipoLabel = { aire_acondicionado: 'aire acondicionado', nevera: 'nevera', otro: 'equipo' };

    for (const rec of pendientes) {
      const tipo = tipoLabel[rec.equipo.tipo] || 'equipo';
      const equipo = `${tipo} ${rec.equipo.marca || ''} ${rec.equipo.modelo || ''}`.trim();
      const mensaje = `🔧 *RefriElectri Pro* — Hola ${rec.cliente.nombre}, te recordamos que tu ${equipo} necesita mantenimiento preventivo. ¡Agenda tu cita y evita averías! Escríbenos para agendar.`;

      try {
        await enviarMensaje(rec.cliente.telefono, mensaje);
        await prisma.recordatorioMantenimiento.update({
          where: { id: rec.id },
          data: { enviado: true, enviado_at: new Date() },
        });
        console.log(`[Recordatorio] Enviado a ${rec.cliente.nombre} (${rec.cliente.telefono})`);
      } catch (err) {
        console.error(`[Recordatorio] Error enviando a ${rec.cliente.telefono}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[Recordatorio] Error verificando recordatorios:', err.message);
  }
};

const iniciarScheduler = () => {
  console.log(`[Recordatorio] Scheduler iniciado — verifica cada ${INTERVALO_HORAS}h`);
  verificarRecordatorios();
  setInterval(verificarRecordatorios, INTERVALO_HORAS * 60 * 60 * 1000);
};

module.exports = { iniciarScheduler, verificarRecordatorios };
