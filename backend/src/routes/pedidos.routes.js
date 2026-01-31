const express = require('express');
const router = express.Router();
const pedidosController = require('../controllers/pedidos.controller');
const { verificarToken, esMozo, esAdminOCajero, verificarRol } = require('../middlewares/auth.middleware');
const { setAuthContext, bloquearSiSoloLectura } = require('../middlewares/tenant.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const {
  idParamSchema,
  listarQuerySchema,
  crearPedidoBodySchema,
  cambiarEstadoBodySchema,
  agregarItemsBodySchema,
  cancelarBodySchema
} = require('../schemas/pedidos.schemas');

router.use(verificarToken);
router.use(setAuthContext);

router.get('/', validate({ query: listarQuerySchema }), asyncHandler(pedidosController.listar));
router.get('/cocina', verificarRol('ADMIN', 'COCINERO'), asyncHandler(pedidosController.pedidosCocina));
router.get('/delivery', verificarRol('ADMIN', 'DELIVERY'), asyncHandler(pedidosController.pedidosDelivery));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(pedidosController.obtener));
router.post('/', bloquearSiSoloLectura, verificarRol('ADMIN', 'CAJERO', 'MOZO'), validate({ body: crearPedidoBodySchema }), asyncHandler(pedidosController.crear));
router.patch('/:id/estado', bloquearSiSoloLectura, verificarRol('ADMIN', 'COCINERO', 'MOZO'), validate({ params: idParamSchema, body: cambiarEstadoBodySchema }), asyncHandler(pedidosController.cambiarEstado));
router.post('/:id/items', bloquearSiSoloLectura, esMozo, validate({ params: idParamSchema, body: agregarItemsBodySchema }), asyncHandler(pedidosController.agregarItems));
router.post('/:id/cancelar', bloquearSiSoloLectura, esAdminOCajero, validate({ params: idParamSchema, body: cancelarBodySchema }), asyncHandler(pedidosController.cancelar));

module.exports = router;
