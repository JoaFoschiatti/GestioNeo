const express = require('express');
const router = express.Router();
const cierresController = require('../controllers/cierres.controller');
const { verificarToken, esAdminOCajero } = require('../middlewares/auth.middleware');
const { setTenantFromAuth, bloquearSiSoloLectura } = require('../middlewares/tenant.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const {
  idParamSchema,
  listarQuerySchema,
  abrirCajaBodySchema,
  cerrarCajaBodySchema
} = require('../schemas/cierres.schemas');

// Todas las rutas requieren autenticación y rol ADMIN o CAJERO
router.use(verificarToken);
router.use(setTenantFromAuth);
router.use(esAdminOCajero);

// GET /api/cierres/actual - Estado actual de caja
router.get('/actual', asyncHandler(cierresController.obtenerActual));

// GET /api/cierres/resumen - Resumen de ventas de caja abierta
router.get('/resumen', asyncHandler(cierresController.resumenActual));

// POST /api/cierres - Abrir nueva caja
router.post('/', bloquearSiSoloLectura, validate({ body: abrirCajaBodySchema }), asyncHandler(cierresController.abrirCaja));

// PATCH /api/cierres/:id/cerrar - Cerrar caja
router.patch('/:id/cerrar', bloquearSiSoloLectura, validate({ params: idParamSchema, body: cerrarCajaBodySchema }), asyncHandler(cierresController.cerrarCaja));

// GET /api/cierres - Histórico de cierres
router.get('/', validate({ query: listarQuerySchema }), asyncHandler(cierresController.listar));

module.exports = router;
