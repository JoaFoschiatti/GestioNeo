const express = require('express');
const router = express.Router();
const empleadosController = require('../controllers/empleados.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');
const { setAuthContext, bloquearSiSoloLectura } = require('../middlewares/tenant.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const {
  idParamSchema,
  listarQuerySchema,
  crearEmpleadoBodySchema,
  actualizarEmpleadoBodySchema
} = require('../schemas/empleados.schemas');

router.use(verificarToken);
router.use(setAuthContext);

router.get('/', validate({ query: listarQuerySchema }), asyncHandler(empleadosController.listar));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(empleadosController.obtener));
router.post('/', bloquearSiSoloLectura, esAdmin, validate({ body: crearEmpleadoBodySchema }), asyncHandler(empleadosController.crear));
router.put('/:id', bloquearSiSoloLectura, esAdmin, validate({ params: idParamSchema, body: actualizarEmpleadoBodySchema }), asyncHandler(empleadosController.actualizar));
router.delete('/:id', bloquearSiSoloLectura, esAdmin, validate({ params: idParamSchema }), asyncHandler(empleadosController.eliminar));

module.exports = router;
