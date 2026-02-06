/**
 * Rutas de Suscripciones SaaS
 * Maneja las suscripciones para el uso del sistema
 */

const express = require('express');
const router = express.Router();
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');
const { setAuthContext } = require('../middlewares/context.middleware');
const controller = require('../controllers/suscripcion.controller');
const { asyncHandler } = require('../utils/async-handler');

// ============================================
// RUTAS PÚBLICAS (webhook de MercadoPago)
// ============================================

// POST /api/suscripcion/webhook - Webhook de MercadoPago para suscripciones
router.post('/webhook', controller.webhookSuscripcion);

// ============================================
// RUTAS PROTEGIDAS (requieren auth + admin)
// ============================================

// POST /api/suscripcion/crear - Crear nueva suscripción
router.post(
  '/crear',
  verificarToken,
  setAuthContext,
  verificarRol('ADMIN'),
  asyncHandler(controller.crearSuscripcion)
);

// GET /api/suscripcion/estado - Estado actual de la suscripción
router.get(
  '/estado',
  verificarToken,
  setAuthContext,
  verificarRol('ADMIN'),
  asyncHandler(controller.obtenerEstado)
);

// POST /api/suscripcion/cancelar - Cancelar suscripción
router.post(
  '/cancelar',
  verificarToken,
  setAuthContext,
  verificarRol('ADMIN'),
  asyncHandler(controller.cancelarSuscripcion)
);

// GET /api/suscripcion/pagos - Historial de pagos
router.get(
  '/pagos',
  verificarToken,
  setAuthContext,
  verificarRol('ADMIN'),
  asyncHandler(controller.obtenerPagos)
);

module.exports = router;
