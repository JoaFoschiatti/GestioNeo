const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const impresionController = require('../controllers/impresion.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const { setTenantFromAuth, setTenantFromSlugHeader } = require('../middlewares/tenant.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const {
  pedidoIdParamSchema,
  jobIdParamSchema,
  imprimirComandaBodySchema,
  previewComandaQuerySchema,
  bridgeClaimBodySchema,
  bridgeAckBodySchema,
  bridgeFailBodySchema
} = require('../schemas/impresion.schemas');

const requireBridgeToken = (req, res, next) => {
  const expected = process.env.BRIDGE_TOKEN;
  if (!expected) {
    return res.status(503).json({ error: { message: 'Bridge token no configurado' } });
  }

  const headerToken = req.headers['x-bridge-token'];
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = headerToken || bearerToken;

  if (!token) {
    return res.status(401).json({ error: { message: 'Token de bridge invalido' } });
  }

  try {
    const valid = crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(token)
    );
    return valid
      ? next()
      : res.status(401).json({ error: { message: 'Token de bridge invalido' } });
  } catch {
    return res.status(401).json({ error: { message: 'Token de bridge invalido' } });
  }
};

// Bridge endpoints (sin JWT, token dedicado)
router.post(
  '/jobs/claim',
  requireBridgeToken,
  asyncHandler(setTenantFromSlugHeader),
  validate({ body: bridgeClaimBodySchema }),
  asyncHandler(impresionController.claimJobs)
);
router.post(
  '/jobs/:id/ack',
  requireBridgeToken,
  asyncHandler(setTenantFromSlugHeader),
  validate({ params: jobIdParamSchema, body: bridgeAckBodySchema }),
  asyncHandler(impresionController.ackJob)
);
router.post(
  '/jobs/:id/fail',
  requireBridgeToken,
  asyncHandler(setTenantFromSlugHeader),
  validate({ params: jobIdParamSchema, body: bridgeFailBodySchema }),
  asyncHandler(impresionController.failJob)
);

// Endpoints protegidos para usuarios autenticados
router.use(verificarToken);
router.use(setTenantFromAuth);

router.post(
  '/comanda/:pedidoId',
  validate({ params: pedidoIdParamSchema, body: imprimirComandaBodySchema }),
  asyncHandler(impresionController.imprimirComanda)
);
router.get(
  '/comanda/:pedidoId/preview',
  validate({ params: pedidoIdParamSchema, query: previewComandaQuerySchema }),
  asyncHandler(impresionController.previewComanda)
);
router.post(
  '/comanda/:pedidoId/reimprimir',
  validate({ params: pedidoIdParamSchema, body: imprimirComandaBodySchema }),
  asyncHandler(impresionController.reimprimirComanda)
);
router.get('/estado', asyncHandler(impresionController.estadoImpresora));

module.exports = router;
