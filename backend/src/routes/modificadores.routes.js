const express = require('express');
const router = express.Router();
const modificadoresController = require('../controllers/modificadores.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');
const { setTenantFromAuth } = require('../middlewares/tenant.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const {
  idParamSchema,
  productoIdParamSchema,
  listarQuerySchema,
  crearModificadorBodySchema,
  actualizarModificadorBodySchema,
  asignarAProductoBodySchema
} = require('../schemas/modificadores.schemas');

// Todas las rutas requieren autenticación
router.use(verificarToken);
router.use(setTenantFromAuth);

// GET /api/modificadores - Listar modificadores
router.get('/', validate({ query: listarQuerySchema }), asyncHandler(modificadoresController.listar));

// GET /api/modificadores/:id - Obtener modificador
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(modificadoresController.obtener));

// GET /api/modificadores/producto/:productoId - Modificadores de un producto
router.get('/producto/:productoId', validate({ params: productoIdParamSchema }), asyncHandler(modificadoresController.modificadoresDeProducto));

// POST /api/modificadores - Crear modificador (solo admin)
router.post('/', esAdmin, validate({ body: crearModificadorBodySchema }), asyncHandler(modificadoresController.crear));

// PUT /api/modificadores/:id - Actualizar modificador (solo admin)
router.put('/:id', esAdmin, validate({ params: idParamSchema, body: actualizarModificadorBodySchema }), asyncHandler(modificadoresController.actualizar));

// DELETE /api/modificadores/:id - Eliminar modificador (solo admin)
router.delete('/:id', esAdmin, validate({ params: idParamSchema }), asyncHandler(modificadoresController.eliminar));

// PUT /api/modificadores/producto/:productoId - Asignar modificadores a producto (solo admin)
router.put(
  '/producto/:productoId',
  esAdmin,
  validate({ params: productoIdParamSchema, body: asignarAProductoBodySchema }),
  asyncHandler(modificadoresController.asignarAProducto)
);

module.exports = router;
