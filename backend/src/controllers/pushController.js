const prisma = require('../config/db');

const suscribir = async (req, res, next) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ success: false, error: 'Suscripción inválida' });
    }
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { usuarioId: req.usuario.id, p256dh: keys.p256dh, auth: keys.auth },
      create: { usuarioId: req.usuario.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const desuscribir = async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint, usuarioId: req.usuario.id },
      });
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const vapidPublicKey = (req, res) => {
  res.json({ success: true, data: { publicKey: process.env.VAPID_PUBLIC_KEY || '' } });
};

module.exports = { suscribir, desuscribir, vapidPublicKey };
