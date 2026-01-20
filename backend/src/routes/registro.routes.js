const express = require('express');
const router = express.Router();
const registroController = require('../controllers/registro.controller');

// POST /api/registro - Register new tenant
router.post('/', registroController.registrar);

// GET /api/registro/verificar/:token - Verify email
router.get('/verificar/:token', registroController.verificarEmail);

// POST /api/registro/reenviar - Resend verification email
router.post('/reenviar', registroController.reenviarVerificacion);

// GET /api/registro/slug/:slug - Check slug availability
router.get('/slug/:slug', registroController.verificarSlug);

module.exports = router;
