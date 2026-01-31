const express = require('express');
const { verificarToken } = require('../middlewares/auth.middleware');
const eventBus = require('../services/event-bus');
const { logger } = require('../utils/logger');

const router = express.Router();

router.get('/', (req, res, next) => {
  const token = req.query.token;
  if (token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${token}`;
  }
  return verificarToken(req, res, next);
}, (req, res) => {
  const userTenantId = req.usuario?.tenantId;
  logger.info(`[SSE] Cliente conectado - Usuario: ${req.usuario?.email}, Tenant: ${userTenantId}`);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event) => {
    // En single-tenant mode, enviamos todos los eventos con tenantId
    const eventTenantId = event.payload?.tenantId;
    if (!eventTenantId) {
      return; // Nunca enviar eventos sin tenantId
    }
    if (eventTenantId !== userTenantId) {
      return; // No enviar eventos de otros tenants (por seguridad)
    }

    logger.info(`[SSE] Enviando evento: ${event.type} a tenant: ${userTenantId}`);
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event.payload)}\n\n`);
  };

  const unsubscribe = eventBus.subscribe(sendEvent);
  const keepAlive = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 15000);

  req.on('close', () => {
    logger.info(`[SSE] Cliente desconectado - Tenant: ${userTenantId}`);
    clearInterval(keepAlive);
    unsubscribe();
  });
});

module.exports = router;
