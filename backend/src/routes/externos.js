const router = require('express').Router();
const { verifyToken } = require('../middlewares/auth');
const { getProductos } = require('../controllers/externosController');

router.use(verifyToken);
router.get('/productos', getProductos);

module.exports = router;
