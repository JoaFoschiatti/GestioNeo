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
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 intentos
  message: {
    error: { message: 'Demasiados intentos de login. Intente nuevamente en 15 minutos.' }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rutas públicas
router.post('/login', loginLimiter, validate({ body: loginBodySchema }), asyncHandler(authController.login));

// Rutas protegidas
router.post('/registrar', verificarToken, setTenantFromAuth, esAdmin, validate({ body: registrarBodySchema }), asyncHandler(authController.registrar));
router.get('/perfil', verificarToken, setTenantFromAuth, asyncHandler(authController.perfil));
router.put('/cambiar-password', verificarToken, setTenantFromAuth, validate({ body: cambiarPasswordBodySchema }), asyncHandler(authController.cambiarPassword));

module.exports = router;
