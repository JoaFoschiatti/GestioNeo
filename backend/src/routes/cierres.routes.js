const express = require('express');
const router = express.Router();
const cierresController = require('../controllers/cierres.controller');
const { verificarToken, esAdminOCajero } = require('../middlewares/auth.middleware');

// Todas las rutas requieren autenticación y rol ADMIN o CAJERO
router.use(verificarToken);
router.use(esAdminOCajero);

// GET /api/cierres/actual - Estado actual de caja
router.get('/actual', cierresController.obtenerActual);

// GET /api/cierres/resumen - Resumen de ventas de caja abierta
router.get('/resumen', cierresController.resumenActual);

// POST /api/cierres - Abrir nueva caja
router.post('/', cierresController.abrirCaja);

// PATCH /api/cierres/:id/cerrar - Cerrar caja
router.patch('/:id/cerrar', cierresController.cerrarCaja);

// GET /api/cierres - Histórico de cierres
router.get('/', cierresController.listar);

module.exports = router;
