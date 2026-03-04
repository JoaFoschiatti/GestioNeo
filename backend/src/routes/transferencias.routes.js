const express = require('express');
const router = express.Router();
const { verificarToken, esAdminOCajero } = require('../middlewares/auth.middleware');
const { setAuthContext } = require('../middlewares/context.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const transferenciasService = require('../services/transferencias.service');
const { logger } = require('../utils/logger');
const {
  transferenciasQuerySchema,
  transferenciaIdParamSchema,
  matchTransferBodySchema,
  rejectTransferBodySchema
} = require('../schemas/transferencias.schemas');

// Todas las rutas requieren autenticacion
router.use(verificarToken);
router.use(setAuthContext);

// Listar transferencias con filtros
router.get(
  '/',
  esAdminOCajero,
  validate({ query: transferenciasQuerySchema }),
  asyncHandler(async (req, res) => {
    const { estado, page = 1, limit = 20, desde, hasta } = req.query;

    const result = await transferenciasService.getTransferencias({
      estado,
      page,
      limit,
      desde,
      hasta
    });

    res.json(result);
  })
);

// Listar solo pendientes de match
router.get(
  '/pendientes',
  esAdminOCajero,
  validate({ query: transferenciasQuerySchema }),
  asyncHandler(async (req, res) => {
    const result = await transferenciasService.getTransferencias({
      estado: 'PENDIENTE',
      page: req.query.page || 1,
      limit: req.query.limit || 20
    });

    res.json(result);
  })
);

// Sincronizar manualmente con MercadoPago
router.post(
  '/sync',
  esAdminOCajero,
  asyncHandler(async (_req, res) => {
    logger.info('Sincronizacion manual de transferencias iniciada');

    const result = await transferenciasService.syncFromMercadoPago();

    res.json({
      success: true,
      ...result
    });
  })
);

// Obtener datos bancarios (CVU/Alias) para configuracion
router.get(
  '/config/datos-bancarios',
  esAdminOCajero,
  asyncHandler(async (_req, res) => {
    const datos = await transferenciasService.getDatosBancarios();

    if (!datos) {
      return res.json({
        habilitado: false,
        cvu: null,
        alias: null,
        titular: null
      });
    }

    return res.json(datos);
  })
);

// Obtener info de cuenta MP (para configuracion inicial)
router.get(
  '/config/account-info',
  esAdminOCajero,
  asyncHandler(async (_req, res) => {
    const info = await transferenciasService.getAccountInfo();

    if (!info) {
      return res.status(404).json({
        error: { message: 'No se pudo obtener informacion de la cuenta de MercadoPago' }
      });
    }

    return res.json(info);
  })
);

// Obtener candidatos de match para una transferencia
router.get(
  '/:id/candidatos',
  esAdminOCajero,
  validate({ params: transferenciaIdParamSchema }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const candidatos = await transferenciasService.getCandidatosParaMatch(id);
    res.json({ candidatos });
  })
);

// Match manual de transferencia a pedido
router.post(
  '/:id/match',
  esAdminOCajero,
  validate({ params: transferenciaIdParamSchema, body: matchTransferBodySchema }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { pedidoId } = req.body;

    const result = await transferenciasService.manualMatchTransfer(id, pedidoId);

    logger.info(`Match manual: Transferencia ${id} -> Pedido ${pedidoId}`);

    res.json({
      success: true,
      transferencia: result.transferencia,
      pago: result.pago
    });
  })
);

// Rechazar transferencia
router.post(
  '/:id/rechazar',
  esAdminOCajero,
  validate({ params: transferenciaIdParamSchema, body: rejectTransferBodySchema }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { motivo } = req.body;

    const transferencia = await transferenciasService.rejectTransfer(
      id,
      motivo || 'Rechazada manualmente'
    );

    logger.info(`Transferencia ${id} rechazada: ${motivo || 'Rechazada manualmente'}`);

    res.json({ success: true, transferencia });
  })
);

module.exports = router;
