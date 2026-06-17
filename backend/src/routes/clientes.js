const router = require('express').Router();
const { listar, obtener, crear, actualizar, listarEquipos, crearEquipo, historialCliente, listarDirecciones, agregarDireccion, actualizarDireccion, eliminarDireccion } = require('../controllers/clientesController');
const { verifyToken } = require('../middlewares/auth');

router.use(verifyToken);

router.get('/', listar);
router.post('/', crear);
router.get('/:id', obtener);
router.put('/:id', actualizar);
router.get('/:id/historial', historialCliente);
router.get('/:id/equipos', listarEquipos);
router.post('/:id/equipos', crearEquipo);
router.get('/:id/direcciones', listarDirecciones);
router.post('/:id/direcciones', agregarDireccion);
router.put('/:id/direcciones/:dirId', actualizarDireccion);
router.delete('/:id/direcciones/:dirId', eliminarDireccion);

module.exports = router;
