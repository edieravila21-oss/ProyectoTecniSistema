const router = require('express').Router();
const { verifyToken } = require('../middlewares/auth');
const { listar, crear, actualizar, eliminar } = require('../controllers/calendarioController');

router.use(verifyToken);

router.get('/', listar);
router.post('/', crear);
router.put('/:id', actualizar);
router.delete('/:id', eliminar);

module.exports = router;
