const express = require('express');
const router = express.Router();
const registroController = require('../controllers/registro.controller');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const {
  registrarBodySchema,
  verificarEmailParamSchema,
  reenviarBodySchema,
  verificarSlugParamSchema
} = require('../schemas/registro.schemas');

// POST /api/registro - Register new tenant
router.post('/', validate({ body: registrarBodySchema }), asyncHandler(registroController.registrar));

// GET /api/registro/verificar/:token - Verify email
router.get('/verificar/:token', validate({ params: verificarEmailParamSchema }), asyncHandler(registroController.verificarEmail));

// POST /api/registro/reenviar - Resend verification email
router.post('/reenviar', validate({ body: reenviarBodySchema }), asyncHandler(registroController.reenviarVerificacion));

// GET /api/registro/slug/:slug - Check slug availability
router.get('/slug/:slug', validate({ params: verificarSlugParamSchema }), asyncHandler(registroController.verificarSlug));

module.exports = router;
