const express = require('express');
const router = express.Router();
const reportesController = require('../controllers/reportes.controller');
const { verificarToken, verificarPermiso } = require('../middlewares/auth.middleware');
const { setAuthContext } = require('../middlewares/context.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const { CAPABILITY } = require('../auth/permissions');
const {
  ventasReporteQuerySchema,
  productosMasVendidosQuerySchema,
  ventasPorMozoQuerySchema,
  ventasPorProductoBaseQuerySchema,
  consumoInsumosQuerySchema,
  sueldosReporteQuerySchema
} = require('../schemas/reportes.schemas');

router.use(verificarToken);
router.use(setAuthContext);

router.get('/dashboard', verificarPermiso(CAPABILITY.DASHBOARD_VIEW), asyncHandler(reportesController.dashboard));
router.get('/ventas', verificarPermiso(CAPABILITY.REPORTS_VIEW), validate({ query: ventasReporteQuerySchema }), asyncHandler(reportesController.ventasReporte));
router.get(
  '/productos-mas-vendidos',
  verificarPermiso(CAPABILITY.REPORTS_VIEW),
  validate({ query: productosMasVendidosQuerySchema }),
  asyncHandler(reportesController.productosMasVendidos)
);
router.get('/ventas-por-mozo', verificarPermiso(CAPABILITY.REPORTS_ADVANCED), validate({ query: ventasPorMozoQuerySchema }), asyncHandler(reportesController.ventasPorMozo));
router.get('/inventario', verificarPermiso(CAPABILITY.REPORTS_ADVANCED), asyncHandler(reportesController.inventarioReporte));
router.get('/sueldos', verificarPermiso(CAPABILITY.REPORTS_ADVANCED), validate({ query: sueldosReporteQuerySchema }), asyncHandler(reportesController.sueldosReporte));

// Reportes de variantes de productos
router.get(
  '/ventas-por-producto-base',
  verificarPermiso(CAPABILITY.REPORTS_VIEW),
  validate({ query: ventasPorProductoBaseQuerySchema }),
  asyncHandler(reportesController.ventasPorProductoBase)
);
router.get(
  '/consumo-insumos',
  verificarPermiso(CAPABILITY.REPORTS_ADVANCED),
  validate({ query: consumoInsumosQuerySchema }),
  asyncHandler(reportesController.consumoInsumos)
);

module.exports = router;
