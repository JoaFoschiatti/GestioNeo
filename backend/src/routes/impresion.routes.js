const express = require('express');
const router = express.Router();
const impresionController = require('../controllers/impresion.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

const requireBridgeToken = (req, res, next) => {
  const expected = process.env.BRIDGE_TOKEN;
  if (!expected) {
    return res.status(503).json({ error: { message: 'Bridge token no configurado' } });
  }

  const headerToken = req.headers['x-bridge-token'];
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = headerToken || bearerToken;

  if (!token || token !== expected) {
    return res.status(401).json({ error: { message: 'Token de bridge invalido' } });
  }

  return next();
};

// Bridge endpoints (sin JWT, token dedicado)
router.post('/jobs/claim', requireBridgeToken, impresionController.claimJobs);
router.post('/jobs/:id/ack', requireBridgeToken, impresionController.ackJob);
router.post('/jobs/:id/fail', requireBridgeToken, impresionController.failJob);

// Endpoints protegidos para usuarios autenticados
router.use(verificarToken);

router.post('/comanda/:pedidoId', impresionController.imprimirComanda);
router.get('/comanda/:pedidoId/preview', impresionController.previewComanda);
router.post('/comanda/:pedidoId/reimprimir', impresionController.reimprimirComanda);
router.get('/estado', impresionController.estadoImpresora);

module.exports = router;
