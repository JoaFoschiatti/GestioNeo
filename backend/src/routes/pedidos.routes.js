const express = require('express');
const router = express.Router();
const pedidosController = require('../controllers/pedidos.controller');
const { verificarToken, esMozo, esAdminOCajero, verificarPermiso } = require('../middlewares/auth.middleware');
const { setAuthContext, bloquearSiSoloLectura } = require('../middlewares/context.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const { CAPABILITY } = require('../auth/permissions');
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

router.get('/', verificarPermiso(CAPABILITY.ORDERS_LIST), validate({ query: listarQuerySchema }), asyncHandler(pedidosController.listar));
router.get('/cocina', verificarPermiso(CAPABILITY.KITCHEN_ACCESS), asyncHandler(pedidosController.pedidosCocina));
router.get('/delivery', verificarPermiso(CAPABILITY.DELIVERY_ACCESS), asyncHandler(pedidosController.pedidosDelivery));
router.get('/:id', verificarPermiso(CAPABILITY.ORDERS_LIST), validate({ params: idParamSchema }), asyncHandler(pedidosController.obtener));
router.post('/', bloquearSiSoloLectura, verificarPermiso(CAPABILITY.ORDERS_CREATE), validate({ body: crearPedidoBodySchema }), asyncHandler(pedidosController.crear));
router.patch('/:id/estado', bloquearSiSoloLectura, verificarPermiso(CAPABILITY.ORDERS_UPDATE_STATUS), validate({ params: idParamSchema, body: cambiarEstadoBodySchema }), asyncHandler(pedidosController.cambiarEstado));
router.post('/:id/items', bloquearSiSoloLectura, esMozo, validate({ params: idParamSchema, body: agregarItemsBodySchema }), asyncHandler(pedidosController.agregarItems));
router.post('/:id/cancelar', bloquearSiSoloLectura, esAdminOCajero, validate({ params: idParamSchema, body: cancelarBodySchema }), asyncHandler(pedidosController.cancelar));

module.exports = router;
