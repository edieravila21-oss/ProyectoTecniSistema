const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../middlewares/auth');
const { suscribir, desuscribir, vapidPublicKey, enviarPushPrueba } = require('../controllers/pushController');

router.get('/vapid-public-key', vapidPublicKey);
router.post('/subscribe', verifyToken, suscribir);
router.post('/unsubscribe', verifyToken, desuscribir);
router.post('/test', verifyToken, requireAdmin, enviarPushPrueba);

module.exports = router;
