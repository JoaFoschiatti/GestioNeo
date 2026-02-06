const express = require('express');
const router = express.Router();
const { verificarToken, esAdminOCajero } = require('../middlewares/auth.middleware');
const { setAuthContext } = require('../middlewares/context.middleware');
const { asyncHandler } = require('../utils/async-handler');
const transferenciasService = require('../services/transferencias.service');
const { logger } = require('../utils/logger');

// Todas las rutas requieren autenticación
router.use(verificarToken);
router.use(setAuthContext);

// Listar transferencias con filtros
router.get('/', esAdminOCajero, asyncHandler(async (req, res) => {
  const { estado, page = 1, limit = 20, desde, hasta } = req.query;

  const result = await transferenciasService.getTransferencias({
    estado,
    page: parseInt(page),
    limit: parseInt(limit),
    desde,
    hasta
  });

  res.json(result);
}));

// Listar solo pendientes de match
router.get('/pendientes', esAdminOCajero, asyncHandler(async (req, res) => {
  const result = await transferenciasService.getTransferencias({
    estado: 'PENDIENTE',
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 20
  });

  res.json(result);
}));

// Obtener candidatos de match para una transferencia
router.get('/:id/candidatos', esAdminOCajero, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const candidatos = await transferenciasService.getCandidatosParaMatch(parseInt(id));

  res.json({ candidatos });
}));

// Match manual de transferencia a pedido
router.post('/:id/match', esAdminOCajero, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { pedidoId } = req.body;

  if (!pedidoId) {
    return res.status(400).json({ error: 'pedidoId es requerido' });
  }

  const result = await transferenciasService.manualMatchTransfer(
    parseInt(id),
    parseInt(pedidoId)
  );

  logger.info(`Match manual: Transferencia ${id} -> Pedido ${pedidoId}`);

  res.json({
    success: true,
    transferencia: result.transferencia,
    pago: result.pago
  });
}));

// Rechazar transferencia
router.post('/:id/rechazar', esAdminOCajero, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;

  const transferencia = await transferenciasService.rejectTransfer(
    parseInt(id),
    motivo || 'Rechazada manualmente'
  );

  logger.info(`Transferencia ${id} rechazada: ${motivo}`);

  res.json({ success: true, transferencia });
}));

// Sincronizar manualmente con MercadoPago
router.post('/sync', esAdminOCajero, asyncHandler(async (req, res) => {
  logger.info('Sincronización manual de transferencias iniciada');

  const result = await transferenciasService.syncFromMercadoPago();

  res.json({
    success: true,
    ...result
  });
}));

// Obtener datos bancarios (CVU/Alias) para configuración
router.get('/config/datos-bancarios', esAdminOCajero, asyncHandler(async (req, res) => {
  const datos = await transferenciasService.getDatosBancarios();

  if (!datos) {
    return res.json({
      habilitado: false,
      cvu: null,
      alias: null,
      titular: null
    });
  }

  res.json(datos);
}));

// Obtener info de cuenta MP (para configuración inicial)
router.get('/config/account-info', esAdminOCajero, asyncHandler(async (req, res) => {
  const info = await transferenciasService.getAccountInfo();

  if (!info) {
    return res.status(404).json({ error: 'No se pudo obtener información de la cuenta de MercadoPago' });
  }

  res.json(info);
}));

module.exports = router;
