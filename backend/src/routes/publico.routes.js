const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { setPublicContext } = require('../middlewares/context.middleware');
const emailService = require('../services/email.service');
const eventBus = require('../services/event-bus');
const { asyncHandler } = require('../utils/async-handler');
const publicoService = require('../services/publico.service');
const { logger } = require('../utils/logger');

// Rate limiter para pedidos públicos (10 pedidos por hora por IP)
// Deshabilitado en entorno de test para permitir E2E tests
const publicOrderLimiter = process.env.NODE_ENV === 'test'
  ? (req, res, next) => next() // Skip en test
  : rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hora
      max: 10,
      message: {
        error: { message: 'Demasiados pedidos creados. Intente nuevamente en 1 hora.' }
      },
      standardHeaders: true,
      legacyHeaders: false
    });

/**
 * Public routes - no authentication required
 * Routes: /api/publico/...
 */

// GET /api/publico/config - Configuración pública
router.get('/config', setPublicContext, asyncHandler(async (req, res) => {
  const result = await publicoService.getPublicConfig(req.prisma);
  res.json(result);
}));

// GET /api/publico/menu - Menú público (categorías con productos)
router.get('/menu', setPublicContext, asyncHandler(async (req, res) => {
  const categorias = await publicoService.getPublicMenu(req.prisma);
  res.json(categorias);
}));

// POST /api/publico/pedido - Crear pedido público
router.post('/pedido', publicOrderLimiter, setPublicContext, asyncHandler(async (req, res) => {
  const result = await publicoService.createPublicOrder(req.prisma, {
    body: req.body
  });

  result.events.forEach(event => eventBus.publish(event.topic, event.payload));

  if (result.shouldSendEmail) {
    try {
      const negocio = await req.prisma.negocio.findUnique({ where: { id: 1 } });
      await emailService.sendOrderConfirmation(result.pedido, negocio);
      logger.info('Email de confirmación enviado a:', result.pedido.clienteEmail);
    } catch (emailError) {
      logger.error('Error al enviar email de confirmación:', emailError);
    }
  }

  res.status(201).json({
    pedido: result.pedido,
    costoEnvio: result.costoEnvio,
    total: result.total,
    initPoint: result.initPoint,
    message: 'Pedido creado correctamente'
  });
}));

// POST /api/publico/pedido/:id/pagar - Iniciar pago MercadoPago
router.post('/pedido/:id/pagar', setPublicContext, asyncHandler(async (req, res) => {
  const pedidoId = parseInt(req.params.id);
  const result = await publicoService.startMercadoPagoPaymentForOrder(req.prisma, { pedidoId });
  res.json(result);
}));

// GET /api/publico/pedido/:id - Obtener estado de pedido
router.get('/pedido/:id', setPublicContext, asyncHandler(async (req, res) => {
  const pedidoId = parseInt(req.params.id);
  const result = await publicoService.getPublicOrderStatus(req.prisma, { pedidoId });
  result.events.forEach(event => eventBus.publish(event.topic, event.payload));
  res.json(result.pedido);
}));

module.exports = router;
