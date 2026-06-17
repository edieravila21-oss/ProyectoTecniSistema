const router = require('express').Router();
const { verifyToken } = require('../middlewares/auth');
const { listar, crear, actualizar, eliminar, disponibilidad, bulk } = require('../controllers/calendarioController');

router.use(verifyToken);

router.get('/disponibilidad', disponibilidad);
router.get('/', listar);
router.post('/bulk', bulk);
router.post('/', crear);
router.put('/:id', actualizar);
router.delete('/:id', eliminar);

module.exports = router;
