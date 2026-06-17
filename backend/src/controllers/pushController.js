const prisma = require('../config/db');

const suscribir = async (req, res, next) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ success: false, error: 'Suscripción inválida' });
    }
    // Verificar que el usuario del token existe antes de guardar
    const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id }, select: { id: true } });
    if (!usuario) {
      return res.status(401).json({ success: false, error: 'Sesión expirada, vuelve a iniciar sesión', code: 'SESSION_EXPIRED' });
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

const enviarPushPrueba = async (req, res, next) => {
  try {
    const { enviarPushARoles } = require('../services/pushService');

    // Contar suscripciones activas de técnicos
    const subs = await prisma.pushSubscription.findMany({
      where: { usuario: { rol: 'tecnico', activo: true } },
      select: { id: true },
    });

    await enviarPushARoles(
      ['tecnico'],
      '🔔 Notificación de prueba',
      'Las notificaciones push están funcionando correctamente en tu dispositivo.',
      { url: '/tecnico/agenda', tag: 'push-test' }
    );

    res.json({ success: true, data: { enviadas: subs.length } });
  } catch (error) {
    next(error);
  }
};

module.exports = { suscribir, desuscribir, vapidPublicKey, enviarPushPrueba };
