const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');
const { setTenantFromAuth } = require('../middlewares/tenant.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const { loginBodySchema, registrarBodySchema, cambiarPasswordBodySchema } = require('../schemas/auth.schemas');

// Rate limiter para login (5 intentos por 15 minutos)
// En test usa límite alto (1000) para no bloquear pero genera headers
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === 'test' ? 1000 : 5, // Límite alto en test
  message: {
    error: { message: 'Demasiados intentos de login. Intente nuevamente en 15 minutos.' }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter para cambio de contraseña (5 intentos por 15 minutos)
const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 5,
  message: {
    error: { message: 'Demasiados intentos de cambio de contraseña. Intente nuevamente en 15 minutos.' }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter para registro (5 intentos por hora por IP)
const registroLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: process.env.NODE_ENV === 'test' ? 1000 : 5,
  message: {
    error: { message: 'Demasiados intentos de registro. Intente nuevamente en 1 hora.' }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rutas públicas
router.post('/login', loginLimiter, validate({ body: loginBodySchema }), asyncHandler(authController.login));
router.post('/logout', asyncHandler(authController.logout));

// Rutas protegidas
router.post('/registrar', registroLimiter, verificarToken, setTenantFromAuth, esAdmin, validate({ body: registrarBodySchema }), asyncHandler(authController.registrar));
router.get('/perfil', verificarToken, setTenantFromAuth, asyncHandler(authController.perfil));
router.put('/cambiar-password', passwordChangeLimiter, verificarToken, setTenantFromAuth, validate({ body: cambiarPasswordBodySchema }), asyncHandler(authController.cambiarPassword));

module.exports = router;
