const router = require('express').Router();
const { hoy, resumen, porTecnicos, porEquipos, canales, sla } = require('../controllers/metricasController');
const { verifyToken, requireAdmin } = require('../middlewares/auth');

router.use(verifyToken, requireAdmin);

router.get('/hoy', hoy);
router.get('/resumen', resumen);
router.get('/tecnicos', porTecnicos);
router.get('/equipos', porEquipos);
router.get('/canales', canales);
router.get('/sla', sla);

module.exports = router;
