const router = require('express').Router();
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
