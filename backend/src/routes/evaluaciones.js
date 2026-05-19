const express = require('express');
const router = express.Router();
const evaluacionesController = require('../controllers/evaluacionesController');
const { verifyToken, requireAdmin } = require('../middlewares/auth');

router.use(verifyToken);
router.use(requireAdmin);

router.get('/', evaluacionesController.listar);
router.post('/', evaluacionesController.crear);
router.get('/:id', evaluacionesController.obtener);
router.delete('/:id', evaluacionesController.eliminar);

module.exports = router;
