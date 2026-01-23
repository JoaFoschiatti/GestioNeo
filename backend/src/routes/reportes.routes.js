const express = require('express');
const router = express.Router();
const reportesController = require('../controllers/reportes.controller');
const { verificarToken, esAdmin, esAdminOCajero } = require('../middlewares/auth.middleware');
const { setTenantFromAuth } = require('../middlewares/tenant.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const {
  ventasReporteQuerySchema,
  productosMasVendidosQuerySchema,
  ventasPorMozoQuerySchema,
  ventasPorProductoBaseQuerySchema,
  consumoInsumosQuerySchema,
  sueldosReporteQuerySchema
} = require('../schemas/reportes.schemas');

router.use(verificarToken);
router.use(setTenantFromAuth);

router.get('/dashboard', asyncHandler(reportesController.dashboard));
router.get('/ventas', esAdminOCajero, validate({ query: ventasReporteQuerySchema }), asyncHandler(reportesController.ventasReporte));
router.get(
  '/productos-mas-vendidos',
  esAdminOCajero,
  validate({ query: productosMasVendidosQuerySchema }),
  asyncHandler(reportesController.productosMasVendidos)
);
router.get('/ventas-por-mozo', esAdmin, validate({ query: ventasPorMozoQuerySchema }), asyncHandler(reportesController.ventasPorMozo));
router.get('/inventario', esAdmin, asyncHandler(reportesController.inventarioReporte));
router.get('/sueldos', esAdmin, validate({ query: sueldosReporteQuerySchema }), asyncHandler(reportesController.sueldosReporte));

// Reportes de variantes de productos
router.get(
  '/ventas-por-producto-base',
  esAdminOCajero,
  validate({ query: ventasPorProductoBaseQuerySchema }),
  asyncHandler(reportesController.ventasPorProductoBase)
);
router.get(
  '/consumo-insumos',
  esAdmin,
  validate({ query: consumoInsumosQuerySchema }),
  asyncHandler(reportesController.consumoInsumos)
);

module.exports = router;
