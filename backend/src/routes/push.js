const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
const { suscribir, desuscribir, vapidPublicKey } = require('../controllers/pushController');

router.get('/vapid-public-key', vapidPublicKey);
router.post('/subscribe', verifyToken, suscribir);
router.post('/unsubscribe', verifyToken, desuscribir);

module.exports = router;
