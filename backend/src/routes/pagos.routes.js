const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const pagosController = require('../controllers/pagos.controller');
const { verificarToken, verificarPermiso } = require('../middlewares/auth.middleware');
const { setAuthContext, bloquearSiSoloLectura } = require('../middlewares/context.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const { CAPABILITY } = require('../auth/permissions');
const {
  pedidoIdParamSchema,
  registrarPagoBodySchema,
  crearPreferenciaBodySchema
} = require('../schemas/pagos.schemas');

// Rate limiter para webhooks públicos - previene DoS
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: process.env.NODE_ENV === 'test' ? 1000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Demasiadas solicitudes al webhook' } }
});

// Webhooks públicos de MercadoPago (sin auth, con rate limiting)
router.post('/webhook/mercadopago', webhookLimiter, asyncHandler(pagosController.webhookMercadoPago));
router.post('/webhook/mercadopago/movements', webhookLimiter, asyncHandler(pagosController.webhookMercadoPagoMovements));

// Rutas protegidas
router.use(verificarToken);
router.use(setAuthContext);

router.post('/', bloquearSiSoloLectura, verificarPermiso(CAPABILITY.PAYMENT_REGISTER), validate({ body: registrarPagoBodySchema }), asyncHandler(pagosController.registrarPago));
router.post('/mercadopago/preferencia', bloquearSiSoloLectura, validate({ body: crearPreferenciaBodySchema }), asyncHandler(pagosController.crearPreferenciaMercadoPago));
router.get('/pedido/:pedidoId', verificarPermiso(CAPABILITY.ORDERS_LIST), validate({ params: pedidoIdParamSchema }), asyncHandler(pagosController.listarPagosPedido));

module.exports = router;
