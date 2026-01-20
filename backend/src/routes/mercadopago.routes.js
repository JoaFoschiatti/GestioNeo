/**
 * Rutas de MercadoPago OAuth y configuración por Tenant
 */

const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middlewares/auth.middleware');
const { setTenantFromAuth } = require('../middlewares/tenant.middleware');
const controller = require('../controllers/mercadopago-oauth.controller');

/**
 * Middleware para verificar rol ADMIN
 */
const requireAdmin = (req, res, next) => {
  if (req.usuario.rol !== 'ADMIN' && req.usuario.rol !== 'SUPER_ADMIN') {
    return res.status(403).json({
      error: { message: 'Se requiere rol de administrador' }
    });
  }
  next();
};

// ============================================
// RUTAS PÚBLICAS (callback de OAuth)
// ============================================

// GET /api/mercadopago/oauth/callback - Callback de MercadoPago (público)
router.get('/oauth/callback', controller.callbackOAuth);

// ============================================
// RUTAS PROTEGIDAS (requieren auth + admin + tenant)
// ============================================

// GET /api/mercadopago/oauth/authorize - Iniciar flujo OAuth
router.get('/oauth/authorize', verificarToken, requireAdmin, setTenantFromAuth, controller.iniciarOAuth);

// DELETE /api/mercadopago/oauth/disconnect - Desconectar cuenta
router.delete('/oauth/disconnect', verificarToken, requireAdmin, setTenantFromAuth, controller.desconectarOAuth);

// GET /api/mercadopago/status - Estado de conexión
router.get('/status', verificarToken, requireAdmin, setTenantFromAuth, controller.obtenerEstado);

// POST /api/mercadopago/config/manual - Configuración manual con Access Token
router.post('/config/manual', verificarToken, requireAdmin, setTenantFromAuth, controller.configurarManual);

// GET /api/mercadopago/transacciones - Historial de transacciones
router.get('/transacciones', verificarToken, requireAdmin, setTenantFromAuth, controller.listarTransacciones);

module.exports = router;
