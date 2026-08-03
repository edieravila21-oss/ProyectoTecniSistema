const router = require('express').Router();
const prisma = require('../config/db');
const { listarConversaciones, obtenerConversacion, cambiarEstado, toggleBot, agregarNota, estadoBot, conectar, desconectar, eliminarConversacion } = require('../controllers/whatsappController');
const { verifyToken, requireAdmin } = require('../middlewares/auth');

router.use(verifyToken, requireAdmin);

router.get('/conversaciones', listarConversaciones);
router.get('/conversacion/:telefono', obtenerConversacion);
router.patch('/conversacion/:telefono/estado', cambiarEstado);
router.patch('/conversacion/:telefono/bot', toggleBot);
router.patch('/conversacion/:telefono/notas', agregarNota);
router.get('/estado', estadoBot);
router.post('/conectar', conectar);
router.post('/desconectar', desconectar);
router.delete('/conversacion/:telefono', eliminarConversacion);

router.post('/conversacion/:telefono/enviar', async (req, res) => {
  const { telefono } = req.params;
  const { mensaje } = req.body;
  if (!mensaje?.trim()) return res.status(400).json({ success: false, error: 'Mensaje requerido' });
  try {
    const { enviarMensaje } = require('../whatsapp/bot');
    await enviarMensaje(`${telefono}@s.whatsapp.net`, mensaje.trim());
    await prisma.mensajeWhatsApp.create({
      data: { telefono, direccion: 'saliente', contenido: mensaje.trim(), tipo: 'texto', estado: 'procesado', sesion_id: telefono },
    });
    const { getIO } = require('../config/socket');
    try { getIO().to('admin').emit('whatsapp_conversacion_update', { telefono }); } catch (_) {}
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/enviar-encuesta', async (req, res) => {
  const { telefono } = req.body;
  if (!telefono) return res.status(400).json({ success: false, error: 'Teléfono requerido' });

  try {
    const { enviarEncuestaCalificacion } = require('../whatsapp/bot');
    const testId = `test_${Date.now()}`;
    await enviarEncuestaCalificacion(telefono, testId);
    res.json({ success: true, data: { message: 'Encuesta enviada', testId } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
