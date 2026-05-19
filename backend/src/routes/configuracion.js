const router = require('express').Router();
const { obtener, actualizar } = require('../controllers/configuracionController');
const { verifyToken, requireAdmin } = require('../middlewares/auth');

router.use(verifyToken, requireAdmin);

router.get('/', obtener);
router.put('/', actualizar);

module.exports = router;
