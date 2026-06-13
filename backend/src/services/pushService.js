const webpush = require('web-push');
const prisma = require('../config/db');

webpush.setVapidDetails(
  'mailto:admin@refrielectric.uk',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Cuenta servicios pendientes/activos de un técnico para el badge
async function contarPendientesTecnico(tecnicoId) {
  return prisma.servicio.count({
    where: { tecnicoId, estado: { in: ['asignado', 'en_camino', 'en_servicio'] } },
  });
}

// Cuenta servicios completados hoy para el admin (por revisar)
async function contarCompletadosHoyAdmin() {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return prisma.servicio.count({
    where: { estado: 'completado', updatedAt: { gte: hoy } },
  });
}

const enviarPush = async (usuarioId, titulo, cuerpo, datos = {}) => {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  const subs = await prisma.pushSubscription.findMany({ where: { usuarioId } });

  // Calcular badge según el rol del usuario
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { rol: true } });
  const badge = usuario?.rol === 'tecnico'
    ? await contarPendientesTecnico(usuarioId)
    : await contarCompletadosHoyAdmin();

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ titulo, cuerpo, datos, badge })
      );
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
    }
  }
};

const enviarPushARoles = async (roles, titulo, cuerpo, datos = {}) => {
  const usuarios = await prisma.usuario.findMany({
    where: { rol: { in: roles }, activo: true },
    select: { id: true },
  });
  await Promise.all(usuarios.map(u => enviarPush(u.id, titulo, cuerpo, datos)));
};

module.exports = { enviarPush, enviarPushARoles };
