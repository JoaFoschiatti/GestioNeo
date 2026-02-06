const express = require('express');
const jwt = require('jsonwebtoken');
const { verificarToken } = require('../middlewares/auth.middleware');
const eventBus = require('../services/event-bus');
const { logger } = require('../utils/logger');

const router = express.Router();

router.get('/', (req, res, next) => {
  const token = req.query.token;
  if (token && !req.headers.authorization) {
    // Verify that query-string tokens carry the short-lived SSE purpose claim.
    // This prevents the long-lived main JWT from being accepted via URL.
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.purpose !== 'sse') {
        return res.status(401).json({ error: { message: 'Token de query debe ser un token SSE de corta duración' } });
      }
    } catch (err) {
      return res.status(401).json({ error: { message: 'Token SSE inválido o expirado' } });
    }
    req.headers.authorization = `Bearer ${token}`;
  }
  return verificarToken(req, res, next);
}, (req, res) => {
  logger.info(`[SSE] Cliente conectado - Usuario: ${req.usuario?.email}`);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event) => {
    // Single-tenant: only forward events with tenantId === 1
    const eventTenantId = event.payload?.tenantId;
    if (eventTenantId !== 1) {
      return;
    }

    logger.info(`[SSE] Enviando evento: ${event.type}`);
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event.payload)}\n\n`);
  };

  const unsubscribe = eventBus.subscribe(sendEvent);
  const keepAlive = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 15000);

  req.on('close', () => {
    logger.info('[SSE] Cliente desconectado');
    clearInterval(keepAlive);
    unsubscribe();
  });
});

module.exports = router;
