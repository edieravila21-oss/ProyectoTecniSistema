const webpush = require('web-push');
const prisma = require('../config/db');

webpush.setVapidDetails(
  'mailto:admin@refrielectric.uk',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const enviarPush = async (usuarioId, titulo, cuerpo, datos = {}) => {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  const subs = await prisma.pushSubscription.findMany({ where: { usuarioId } });
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ titulo, cuerpo, datos })
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
