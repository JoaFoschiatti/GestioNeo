const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { resolveTenantFromSlug } = require('../middlewares/tenant.middleware');
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
 * All public routes require slug parameter for tenant resolution
 * Routes: /api/publico/:slug/...
 */

// GET /api/publico/:slug/config - Configuración pública del tenant
router.get('/:slug/config', resolveTenantFromSlug, asyncHandler(async (req, res) => {
  const result = await publicoService.getPublicConfig(req.prisma, req.tenantId, req.tenant);
  res.json(result);
}));

// GET /api/publico/:slug/menu - Menú público (categorías con productos)
router.get('/:slug/menu', resolveTenantFromSlug, asyncHandler(async (req, res) => {
  const categorias = await publicoService.getPublicMenu(req.prisma);
  res.json(categorias);
}));

// POST /api/publico/:slug/pedido - Crear pedido público
router.post('/:slug/pedido', publicOrderLimiter, resolveTenantFromSlug, asyncHandler(async (req, res) => {
  const result = await publicoService.createPublicOrder(req.prisma, {
    tenantId: req.tenantId,
    tenantSlug: req.tenantSlug,
    tenant: req.tenant,
    body: req.body
  });

  result.events.forEach(event => eventBus.publish(event.topic, event.payload));

  if (result.shouldSendEmail) {
      try {
        await emailService.sendOrderConfirmation(result.pedido, req.tenant);
        logger.info('Email de confirmación enviado a:', result.pedido.clienteEmail);
      } catch (emailError) {
        logger.error('Error al enviar email de confirmación:', emailError);
      }
    }

  res.status(201).json({
    pedido: result.pedido,
    costoEnvio: result.costoEnvio,
    total: result.total,
    initPoint: result.initPoint, // Incluir initPoint para MercadoPago
    message: 'Pedido creado correctamente'
  });
}));

// POST /api/publico/:slug/pedido/:id/pagar - Iniciar pago MercadoPago
router.post('/:slug/pedido/:id/pagar', resolveTenantFromSlug, asyncHandler(async (req, res) => {
  const pedidoId = parseInt(req.params.id);
  const result = await publicoService.startMercadoPagoPaymentForOrder(req.prisma, {
    tenantId: req.tenantId,
    tenantSlug: req.tenantSlug,
    tenant: req.tenant,
    pedidoId
  });
  res.json(result);
}));

// GET /api/publico/:slug/pedido/:id - Obtener estado de pedido
router.get('/:slug/pedido/:id', resolveTenantFromSlug, asyncHandler(async (req, res) => {
  const pedidoId = parseInt(req.params.id);
  const result = await publicoService.getPublicOrderStatus(req.prisma, { tenantId: req.tenantId, pedidoId });
  result.events.forEach(event => eventBus.publish(event.topic, event.payload));
  res.json(result.pedido);
}));

// ============================================
// BACKWARDS COMPATIBILITY ROUTES
// These redirect to the default tenant during migration
// ============================================

// GET /api/publico/config - Redirect to default tenant
router.get('/config', async (req, res) => {
  console.warn('[DEPRECATION] /api/publico/config is deprecated. Use /api/publico/:slug/config');
  res.redirect(301, '/api/publico/default/config');
});

// GET /api/publico/menu - Redirect to default tenant
router.get('/menu', async (req, res) => {
  console.warn('[DEPRECATION] /api/publico/menu is deprecated. Use /api/publico/:slug/menu');
  res.redirect(301, '/api/publico/default/menu');
});

module.exports = router;
