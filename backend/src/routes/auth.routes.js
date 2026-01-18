const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');

// Rutas públicas
router.post('/login', authController.login);

// Rutas protegidas
router.post('/registrar', verificarToken, esAdmin, authController.registrar);
router.get('/perfil', verificarToken, authController.perfil);
router.put('/cambiar-password', verificarToken, authController.cambiarPassword);

module.exports = router;
