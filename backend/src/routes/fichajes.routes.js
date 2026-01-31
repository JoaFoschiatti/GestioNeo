const express = require('express');
const router = express.Router();
const fichajesController = require('../controllers/fichajes.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');
const { setAuthContext, bloquearSiSoloLectura } = require('../middlewares/tenant.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const {
  idParamSchema,
  empleadoIdParamSchema,
  listarQuerySchema,
  registrarBodySchema,
  calcularHorasQuerySchema,
  editarBodySchema
} = require('../schemas/fichajes.schemas');

router.use(verificarToken);
router.use(setAuthContext);

router.get('/', validate({ query: listarQuerySchema }), asyncHandler(fichajesController.listar));
router.post('/entrada', bloquearSiSoloLectura, validate({ body: registrarBodySchema }), asyncHandler(fichajesController.registrarEntrada));
router.post('/salida', bloquearSiSoloLectura, validate({ body: registrarBodySchema }), asyncHandler(fichajesController.registrarSalida));
router.get('/empleado/:empleadoId/estado', validate({ params: empleadoIdParamSchema }), asyncHandler(fichajesController.estadoEmpleado));
router.get(
  '/empleado/:empleadoId/horas',
  validate({ params: empleadoIdParamSchema, query: calcularHorasQuerySchema }),
  asyncHandler(fichajesController.calcularHoras)
);
router.put('/:id', bloquearSiSoloLectura, esAdmin, validate({ params: idParamSchema, body: editarBodySchema }), asyncHandler(fichajesController.editar));

module.exports = router;
