const router = require('express').Router();
const { verifyToken } = require('../middlewares/auth');
const { getProductos, getProductosComunes } = require('../controllers/externosController');

router.use(verifyToken);
router.get('/productos/comunes', getProductosComunes);
router.get('/productos', getProductos);

module.exports = router;
