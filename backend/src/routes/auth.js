const router = require('express').Router();
const { login, loginConPin, me, refresh, forgotPassword, resetPassword, cambiarPin, verificarEmail } = require('../controllers/authController');
const { verifyToken } = require('../middlewares/auth');

router.post('/verificar-email', verificarEmail);
router.post('/login', login);
router.post('/login-pin', loginConPin);
router.get('/me', verifyToken, me);
router.post('/refresh', verifyToken, refresh);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.put('/cambiar-pin', verifyToken, cambiarPin);

module.exports = router;
