const express = require('express');
const router = express.Router();
const liquidacionesController = require('../controllers/liquidaciones.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');
const { setAuthContext, bloquearSiSoloLectura } = require('../middlewares/tenant.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const {
  idParamSchema,
  listarQuerySchema,
  calcularBodySchema,
  crearBodySchema
} = require('../schemas/liquidaciones.schemas');

router.use(verificarToken);
router.use(setAuthContext);
router.use(esAdmin);

router.get('/', validate({ query: listarQuerySchema }), asyncHandler(liquidacionesController.listar));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(liquidacionesController.obtener));
router.post('/calcular', bloquearSiSoloLectura, validate({ body: calcularBodySchema }), asyncHandler(liquidacionesController.calcular));
router.post('/', bloquearSiSoloLectura, validate({ body: crearBodySchema }), asyncHandler(liquidacionesController.crear));
router.patch('/:id/pagar', bloquearSiSoloLectura, validate({ params: idParamSchema }), asyncHandler(liquidacionesController.marcarPagada));
router.delete('/:id', bloquearSiSoloLectura, validate({ params: idParamSchema }), asyncHandler(liquidacionesController.eliminar));

module.exports = router;
