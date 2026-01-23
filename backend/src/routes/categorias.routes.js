const express = require('express');
const router = express.Router();
const categoriasController = require('../controllers/categorias.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');
const { setTenantFromAuth } = require('../middlewares/tenant.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const {
  idParamSchema,
  listarQuerySchema,
  crearCategoriaBodySchema,
  actualizarCategoriaBodySchema
} = require('../schemas/categorias.schemas');

router.use(verificarToken);
router.use(setTenantFromAuth);

router.get('/publicas', asyncHandler(categoriasController.listarPublicas));
router.get('/', validate({ query: listarQuerySchema }), asyncHandler(categoriasController.listar));
router.post('/', esAdmin, validate({ body: crearCategoriaBodySchema }), asyncHandler(categoriasController.crear));
router.put('/:id', esAdmin, validate({ params: idParamSchema, body: actualizarCategoriaBodySchema }), asyncHandler(categoriasController.actualizar));
router.delete('/:id', esAdmin, validate({ params: idParamSchema }), asyncHandler(categoriasController.eliminar));

module.exports = router;
