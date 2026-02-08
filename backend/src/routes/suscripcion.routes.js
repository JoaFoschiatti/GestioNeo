/**
 * Rutas de Suscripciones SaaS
 * Maneja las suscripciones para el uso del sistema
 */

const express = require('express');
const router = express.Router();
const { verificarToken, verificarPermiso } = require('../middlewares/auth.middleware');
const { setAuthContext } = require('../middlewares/context.middleware');
const controller = require('../controllers/suscripcion.controller');
const { asyncHandler } = require('../utils/async-handler');
const { CAPABILITY } = require('../auth/permissions');

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
  verificarPermiso(CAPABILITY.SUBSCRIPTION_MANAGE),
  asyncHandler(controller.crearSuscripcion)
);

// GET /api/suscripcion/estado - Estado actual de la suscripción
router.get(
  '/estado',
  verificarToken,
  setAuthContext,
  verificarPermiso(CAPABILITY.SUBSCRIPTION_MANAGE),
  asyncHandler(controller.obtenerEstado)
);

// POST /api/suscripcion/cancelar - Cancelar suscripción
router.post(
  '/cancelar',
  verificarToken,
  setAuthContext,
  verificarPermiso(CAPABILITY.SUBSCRIPTION_MANAGE),
  asyncHandler(controller.cancelarSuscripcion)
);

// GET /api/suscripcion/pagos - Historial de pagos
router.get(
  '/pagos',
  verificarToken,
  setAuthContext,
  verificarPermiso(CAPABILITY.SUBSCRIPTION_MANAGE),
  asyncHandler(controller.obtenerPagos)
);

module.exports = router;
