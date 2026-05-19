const router = require('express').Router();
const { listar, obtener, crear, actualizar, toggleActivo, agenda, metricas } = require('../controllers/usuariosController');
const { verifyToken, requireAdmin } = require('../middlewares/auth');

router.use(verifyToken, requireAdmin);

router.get('/', listar);
router.post('/', crear);
router.get('/:id', obtener);
router.put('/:id', actualizar);
router.patch('/:id/toggle-activo', toggleActivo);
router.get('/:id/agenda', agenda);
router.get('/:id/metricas', metricas);

module.exports = router;
