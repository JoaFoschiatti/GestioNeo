const express = require('express');
const router = express.Router();
const reportesController = require('../controllers/reportes.controller');
const { verificarToken, esAdmin, esAdminOCajero } = require('../middlewares/auth.middleware');

router.use(verificarToken);

router.get('/dashboard', reportesController.dashboard);
router.get('/ventas', esAdminOCajero, reportesController.ventasReporte);
router.get('/productos-mas-vendidos', esAdminOCajero, reportesController.productosMasVendidos);
router.get('/ventas-por-mozo', esAdmin, reportesController.ventasPorMozo);
router.get('/inventario', esAdmin, reportesController.inventarioReporte);
router.get('/sueldos', esAdmin, reportesController.sueldosReporte);

module.exports = router;
