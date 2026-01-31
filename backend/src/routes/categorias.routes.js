const express = require('express');
const router = express.Router();
const categoriasController = require('../controllers/categorias.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');
const { setAuthContext, bloquearSiSoloLectura } = require('../middlewares/tenant.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const {
  idParamSchema,
  listarQuerySchema,
  crearCategoriaBodySchema,
  actualizarCategoriaBodySchema
} = require('../schemas/categorias.schemas');

router.use(verificarToken);
router.use(setAuthContext);

router.get('/publicas', asyncHandler(categoriasController.listarPublicas));
router.get('/', validate({ query: listarQuerySchema }), asyncHandler(categoriasController.listar));
router.post('/', bloquearSiSoloLectura, esAdmin, validate({ body: crearCategoriaBodySchema }), asyncHandler(categoriasController.crear));
router.put('/:id', bloquearSiSoloLectura, esAdmin, validate({ params: idParamSchema, body: actualizarCategoriaBodySchema }), asyncHandler(categoriasController.actualizar));
router.delete('/:id', bloquearSiSoloLectura, esAdmin, validate({ params: idParamSchema }), asyncHandler(categoriasController.eliminar));

module.exports = router;
