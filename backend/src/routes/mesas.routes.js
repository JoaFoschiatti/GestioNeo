const express = require('express');
const router = express.Router();
const mesasController = require('../controllers/mesas.controller');
const { verificarToken, esAdmin, esMozo } = require('../middlewares/auth.middleware');
const { setTenantFromAuth, bloquearSiSoloLectura } = require('../middlewares/tenant.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const {
  idParamSchema,
  listarQuerySchema,
  crearMesaBodySchema,
  actualizarMesaBodySchema,
  cambiarEstadoBodySchema
} = require('../schemas/mesas.schemas');

router.use(verificarToken);
router.use(setTenantFromAuth);

router.get('/', validate({ query: listarQuerySchema }), asyncHandler(mesasController.listar));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(mesasController.obtener));
router.post('/', bloquearSiSoloLectura, esAdmin, validate({ body: crearMesaBodySchema }), asyncHandler(mesasController.crear));
router.put('/:id', bloquearSiSoloLectura, esAdmin, validate({ params: idParamSchema, body: actualizarMesaBodySchema }), asyncHandler(mesasController.actualizar));
router.patch('/:id/estado', bloquearSiSoloLectura, esMozo, validate({ params: idParamSchema, body: cambiarEstadoBodySchema }), asyncHandler(mesasController.cambiarEstado));
router.delete('/:id', bloquearSiSoloLectura, esAdmin, validate({ params: idParamSchema }), asyncHandler(mesasController.eliminar));

module.exports = router;
