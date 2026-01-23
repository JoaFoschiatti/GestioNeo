/**
 * Rutas de MercadoPago OAuth y configuración por Tenant
 */

const express = require('express');
const router = express.Router();
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');
const { setTenantFromAuth } = require('../middlewares/tenant.middleware');
const controller = require('../controllers/mercadopago-oauth.controller');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const { configManualBodySchema, transaccionesQuerySchema } = require('../schemas/mercadopago.schemas');

// ============================================
// RUTAS PÚBLICAS (callback de OAuth)
// ============================================

// GET /api/mercadopago/oauth/callback - Callback de MercadoPago (público)
router.get('/oauth/callback', controller.callbackOAuth);

// ============================================
// RUTAS PROTEGIDAS (requieren auth + admin + tenant)
// ============================================

// GET /api/mercadopago/oauth/authorize - Iniciar flujo OAuth
router.get('/oauth/authorize', verificarToken, setTenantFromAuth, verificarRol('ADMIN'), asyncHandler(controller.iniciarOAuth));

// DELETE /api/mercadopago/oauth/disconnect - Desconectar cuenta
router.delete('/oauth/disconnect', verificarToken, setTenantFromAuth, verificarRol('ADMIN'), asyncHandler(controller.desconectarOAuth));

// GET /api/mercadopago/status - Estado de conexión
router.get('/status', verificarToken, setTenantFromAuth, verificarRol('ADMIN'), asyncHandler(controller.obtenerEstado));

// POST /api/mercadopago/config/manual - Configuración manual con Access Token
router.post('/config/manual', verificarToken, setTenantFromAuth, verificarRol('ADMIN'), validate({ body: configManualBodySchema }), asyncHandler(controller.configurarManual));

// GET /api/mercadopago/transacciones - Historial de transacciones
router.get('/transacciones', verificarToken, setTenantFromAuth, verificarRol('ADMIN'), validate({ query: transaccionesQuerySchema }), asyncHandler(controller.listarTransacciones));

module.exports = router;
