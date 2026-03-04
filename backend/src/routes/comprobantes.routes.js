const express = require('express');
const router = express.Router();
const comprobantesController = require('../controllers/comprobantes.controller');
const { verificarToken, verificarPermiso } = require('../middlewares/auth.middleware');
const { setAuthContext, bloquearSiSoloLectura } = require('../middlewares/context.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const { CAPABILITY } = require('../auth/permissions');
const {
  emitirComprobanteBodySchema,
  consumidorFinalBodySchema,
  listarComprobantesQuerySchema,
  idParamSchema,
  pedidoIdParamSchema
} = require('../schemas/comprobantes.schemas');

router.use(verificarToken);
router.use(setAuthContext);

// Emisión de comprobantes
router.post('/', bloquearSiSoloLectura, verificarPermiso(CAPABILITY.PAYMENT_REGISTER), validate({ body: emitirComprobanteBodySchema }), asyncHandler(comprobantesController.emitirComprobante));
router.post('/consumidor-final', bloquearSiSoloLectura, verificarPermiso(CAPABILITY.PAYMENT_REGISTER), validate({ body: consumidorFinalBodySchema }), asyncHandler(comprobantesController.emitirConsumidorFinal));

// Consultas
router.get('/', verificarPermiso(CAPABILITY.REPORTS_VIEW), validate({ query: listarComprobantesQuerySchema }), asyncHandler(comprobantesController.listarComprobantes));

// IMPORTANTE: rutas con paths fijos ANTES de /:id
router.get('/pedido/:pedidoId', verificarPermiso(CAPABILITY.ORDERS_LIST), validate({ params: pedidoIdParamSchema }), asyncHandler(comprobantesController.obtenerPorPedido));
router.get('/:id', verificarPermiso(CAPABILITY.REPORTS_VIEW), validate({ params: idParamSchema }), asyncHandler(comprobantesController.obtenerComprobante));

// Reintentar comprobante fallido
router.post('/:id/reintentar', bloquearSiSoloLectura, verificarPermiso(CAPABILITY.PAYMENT_REGISTER), validate({ params: idParamSchema }), asyncHandler(comprobantesController.reintentarComprobante));

module.exports = router;
