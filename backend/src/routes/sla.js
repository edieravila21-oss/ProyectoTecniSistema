const router = require('express').Router();
const {
  getAll,
  getByType,
  create,
  update,
  deactivate,
} = require('../controllers/slaConfigController');
const { verifyToken, requireAdmin } = require('../middlewares/auth');

router.use(verifyToken, requireAdmin);

// GET /api/sla-config - obtener todas las configuraciones de SLA
router.get('/', getAll);

// GET /api/sla-config/:tipo_servicio - obtener SLA de un tipo específico
router.get('/:tipo_servicio', getByType);

// POST /api/sla-config - crear nueva configuración de SLA
router.post('/', create);

// PUT /api/sla-config/:tipo_servicio - actualizar SLA
router.put('/:tipo_servicio', update);

// DELETE /api/sla-config/:tipo_servicio - desactivar SLA
router.delete('/:tipo_servicio', deactivate);

module.exports = router;
