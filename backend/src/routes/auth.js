const router = require('express').Router();
const { login, me, refresh, forgotPassword, resetPassword, cambiarPin } = require('../controllers/authController');
const { verifyToken } = require('../middlewares/auth');

router.post('/login', login);
router.get('/me', verifyToken, me);
router.post('/refresh', verifyToken, refresh);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.put('/cambiar-pin', verifyToken, cambiarPin);

module.exports = router;
