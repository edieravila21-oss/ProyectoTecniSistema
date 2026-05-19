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

module.exports = router;
