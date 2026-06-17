const router = require('express').Router();
const { verifyToken, requireAdmin } = require('../middlewares/auth');
const {
  listar, obtener, crear, actualizar, eliminar,
  agregarItem, actualizarItem, eliminarItem, reemplazarItems,
} = require('../controllers/catalogoServiciosController');

router.use(verifyToken, requireAdmin);

router.get('/', listar);
router.get('/:id', obtener);
router.post('/', crear);
router.put('/:id', actualizar);
router.delete('/:id', eliminar);

router.post('/:id/items', agregarItem);
router.put('/:id/items/:itemId', actualizarItem);
router.delete('/:id/items/:itemId', eliminarItem);
router.put('/:id/items', reemplazarItems);

module.exports = router;
