const express = require('express');
const router = express.Router();
const reservasController = require('../controllers/reservas.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');

// Todas las rutas requieren autenticación
router.use(verificarToken);

// GET /api/reservas/proximas - Reservas en los próximos 30 minutos (para mozo)
router.get('/proximas', reservasController.reservasProximas);

// GET /api/reservas - Listar reservas con filtros
router.get('/', reservasController.listar);

// GET /api/reservas/:id - Obtener reserva por ID
router.get('/:id', reservasController.obtener);

// POST /api/reservas - Crear reserva (solo admin)
router.post('/', esAdmin, reservasController.crear);

// PUT /api/reservas/:id - Actualizar reserva (solo admin)
router.put('/:id', esAdmin, reservasController.actualizar);

// PATCH /api/reservas/:id/estado - Cambiar estado de reserva
router.patch('/:id/estado', reservasController.cambiarEstado);

// DELETE /api/reservas/:id - Eliminar reserva (solo admin)
router.delete('/:id', esAdmin, reservasController.eliminar);

module.exports = router;
