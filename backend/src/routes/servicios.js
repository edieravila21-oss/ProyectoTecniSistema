const router = require('express').Router();
const upload = require('../middlewares/upload');
const { verifyToken, requireAdmin } = require('../middlewares/auth');
const {
  listar, obtener, crear, actualizar, cambiarEstado, asignarTecnico,
  obtenerChecklist, marcarChecklist, subirFoto, eliminarFoto, guardarFirma,
  guardarCalificacion, agregarNota, historialEquipo, eliminar, corregirEquipo, registrarEquipo,
  cerrarVencidos, subirFactura, eliminarFactura,
} = require('../controllers/serviciosController');

router.use(verifyToken);

router.get('/', listar);
router.post('/', crear);
router.post('/cerrar-vencidos', requireAdmin, cerrarVencidos);
router.get('/equipo/:equipo_id/historial', historialEquipo);
router.get('/:id', obtener);
router.put('/:id', actualizar);
router.patch('/:id/estado', cambiarEstado);
router.patch('/:id/asignar', requireAdmin, asignarTecnico);
router.get('/:id/checklist', obtenerChecklist);
router.patch('/:id/checklist/:item_id', marcarChecklist);
router.post('/:id/fotos', upload.single('foto'), subirFoto);
router.delete('/:id/fotos/:fotoId', eliminarFoto);
router.post('/:id/firma', guardarFirma);
router.post('/:id/factura', requireAdmin, upload.single('factura'), subirFactura);
router.delete('/:id/factura', requireAdmin, eliminarFactura);
router.patch('/:id/calificacion', guardarCalificacion);
router.post('/:id/notas', agregarNota);
router.delete('/:id', eliminar);
router.post('/:id/equipo', registrarEquipo);
router.patch('/:id/equipo', corregirEquipo);

module.exports = router;
