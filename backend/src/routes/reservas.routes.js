const express = require('express');
const router = express.Router();
const reservasController = require('../controllers/reservas.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');
const { setTenantFromAuth } = require('../middlewares/tenant.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const {
  idParamSchema,
  listarQuerySchema,
  crearReservaBodySchema,
  actualizarReservaBodySchema,
  cambiarEstadoBodySchema
} = require('../schemas/reservas.schemas');

// Todas las rutas requieren autenticación
router.use(verificarToken);
router.use(setTenantFromAuth);

// GET /api/reservas/proximas - Reservas en los próximos 30 minutos (para mozo)
router.get('/proximas', asyncHandler(reservasController.reservasProximas));

// GET /api/reservas - Listar reservas con filtros
router.get('/', validate({ query: listarQuerySchema }), asyncHandler(reservasController.listar));

// GET /api/reservas/:id - Obtener reserva por ID
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(reservasController.obtener));

// POST /api/reservas - Crear reserva (solo admin)
router.post('/', esAdmin, validate({ body: crearReservaBodySchema }), asyncHandler(reservasController.crear));

// PUT /api/reservas/:id - Actualizar reserva (solo admin)
router.put('/:id', esAdmin, validate({ params: idParamSchema, body: actualizarReservaBodySchema }), asyncHandler(reservasController.actualizar));

// PATCH /api/reservas/:id/estado - Cambiar estado de reserva
router.patch('/:id/estado', validate({ params: idParamSchema, body: cambiarEstadoBodySchema }), asyncHandler(reservasController.cambiarEstado));

// DELETE /api/reservas/:id - Eliminar reserva (solo admin)
router.delete('/:id', esAdmin, validate({ params: idParamSchema }), asyncHandler(reservasController.eliminar));

module.exports = router;
