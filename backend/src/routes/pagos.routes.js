const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const pagosController = require('../controllers/pagos.controller');
const { verificarToken, esAdminOCajero } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const {
  pedidoIdParamSchema,
  registrarPagoBodySchema,
  crearPreferenciaBodySchema,
  crearQrOrdenBodySchema
} = require('../schemas/pagos.schemas');

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Demasiadas solicitudes al webhook' } }
});

// Webhook público de MercadoPago (sin auth)
router.post('/webhook/mercadopago', webhookLimiter, asyncHandler(pagosController.webhookMercadoPago));

// Rutas protegidas
router.use(verificarToken);

router.post('/', esAdminOCajero, validate({ body: registrarPagoBodySchema }), asyncHandler(pagosController.registrarPago));
router.post('/mercadopago/preferencia', validate({ body: crearPreferenciaBodySchema }), asyncHandler(pagosController.crearPreferenciaMercadoPago));
router.post('/qr/orden', esAdminOCajero, validate({ body: crearQrOrdenBodySchema }), asyncHandler(pagosController.crearQrOrdenPresencial));
router.get('/pedido/:pedidoId', validate({ params: pedidoIdParamSchema }), asyncHandler(pagosController.listarPagosPedido));

module.exports = router;

