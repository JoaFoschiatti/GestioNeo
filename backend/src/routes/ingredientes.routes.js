const express = require('express');
const router = express.Router();
const ingredientesController = require('../controllers/ingredientes.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');
const { setAuthContext, bloquearSiSoloLectura } = require('../middlewares/context.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const {
  idParamSchema,
  listarQuerySchema,
  crearIngredienteBodySchema,
  actualizarIngredienteBodySchema,
  registrarMovimientoBodySchema,
  ajustarStockBodySchema
} = require('../schemas/ingredientes.schemas');

router.use(verificarToken);
router.use(setAuthContext);

router.get('/', validate({ query: listarQuerySchema }), asyncHandler(ingredientesController.listar));
router.get('/alertas', asyncHandler(ingredientesController.alertasStock));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(ingredientesController.obtener));
router.post('/', bloquearSiSoloLectura, esAdmin, validate({ body: crearIngredienteBodySchema }), asyncHandler(ingredientesController.crear));
router.put('/:id', bloquearSiSoloLectura, esAdmin, validate({ params: idParamSchema, body: actualizarIngredienteBodySchema }), asyncHandler(ingredientesController.actualizar));
router.post(
  '/:id/movimiento',
  bloquearSiSoloLectura,
  esAdmin,
  validate({ params: idParamSchema, body: registrarMovimientoBodySchema }),
  asyncHandler(ingredientesController.registrarMovimiento)
);
router.post(
  '/:id/ajuste',
  bloquearSiSoloLectura,
  esAdmin,
  validate({ params: idParamSchema, body: ajustarStockBodySchema }),
  asyncHandler(ingredientesController.ajustarStock)
);

module.exports = router;
