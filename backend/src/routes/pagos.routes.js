const express = require('express');
const router = express.Router();
const pagosController = require('../controllers/pagos.controller');
const { verificarToken, esAdminOCajero } = require('../middlewares/auth.middleware');
const { setAuthContext, bloquearSiSoloLectura } = require('../middlewares/tenant.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const {
  pedidoIdParamSchema,
  registrarPagoBodySchema,
  crearPreferenciaBodySchema
} = require('../schemas/pagos.schemas');

// Webhook público de MercadoPago (sin auth)
router.post('/webhook/mercadopago', asyncHandler(pagosController.webhookMercadoPago));

// Rutas protegidas
router.use(verificarToken);
router.use(setAuthContext);

router.post('/', bloquearSiSoloLectura, esAdminOCajero, validate({ body: registrarPagoBodySchema }), asyncHandler(pagosController.registrarPago));
router.post('/mercadopago/preferencia', bloquearSiSoloLectura, validate({ body: crearPreferenciaBodySchema }), asyncHandler(pagosController.crearPreferenciaMercadoPago));
router.get('/pedido/:pedidoId', validate({ params: pedidoIdParamSchema }), asyncHandler(pagosController.listarPagosPedido));

module.exports = router;
