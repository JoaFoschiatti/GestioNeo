const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');

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
router.post('/login', loginLimiter, authController.login);

// Rutas protegidas
router.post('/registrar', verificarToken, esAdmin, authController.registrar);
router.get('/perfil', verificarToken, authController.perfil);
router.put('/cambiar-password', verificarToken, authController.cambiarPassword);

module.exports = router;
