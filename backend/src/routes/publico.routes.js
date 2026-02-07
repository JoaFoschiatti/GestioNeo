const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { setPublicContext } = require('../middlewares/context.middleware');
const emailService = require('../services/email.service');
const eventBus = require('../services/event-bus');
const { asyncHandler } = require('../utils/async-handler');
const publicoService = require('../services/publico.service');
const { logger } = require('../utils/logger');

// Rate limiters (deshabilitados en entorno de test para E2E)
const isTest = process.env.NODE_ENV === 'test';
const skipLimiter = (req, res, next) => next();

// 10 pedidos por hora por IP
const publicOrderLimiter = isTest
  ? skipLimiter
  : rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 10,
      message: { error: { message: 'Demasiados pedidos creados. Intente nuevamente en 1 hora.' } },
      standardHeaders: true,
      legacyHeaders: false
    });

// 30 consultas por minuto por IP (previene enumeración de pedidos)
const orderStatusLimiter = isTest
  ? skipLimiter
  : rateLimit({
      windowMs: 60 * 1000,
      max: 30,
      message: { error: { message: 'Demasiadas consultas. Intente nuevamente en un momento.' } },
      standardHeaders: true,
      legacyHeaders: false
    });

// 5 intentos de pago por hora por IP
const paymentLimiter = isTest
  ? skipLimiter
  : rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 5,
      message: { error: { message: 'Demasiados intentos de pago. Intente nuevamente más tarde.' } },
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
router.post('/pedido/:id/pagar', paymentLimiter, setPublicContext, asyncHandler(async (req, res) => {
  const pedidoId = parseInt(req.params.id);
  const result = await publicoService.startMercadoPagoPaymentForOrder(req.prisma, { pedidoId });
  res.json(result);
}));

// GET /api/publico/pedido/:id - Obtener estado de pedido
router.get('/pedido/:id', orderStatusLimiter, setPublicContext, asyncHandler(async (req, res) => {
  const pedidoId = parseInt(req.params.id);
  const result = await publicoService.getPublicOrderStatus(req.prisma, { pedidoId });
  result.events.forEach(event => eventBus.publish(event.topic, event.payload));
  res.json(result.pedido);
}));

module.exports = router;
