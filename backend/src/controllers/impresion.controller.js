const eventBus = require('../services/event-bus');
const { getPrisma } = require('../utils/get-prisma');
const impresionService = require('../services/impresion.service');

const imprimirComanda = async (req, res) => {
  const prisma = getPrisma(req);
  const { pedidoId } = req.params;
  const anchoMm = req.body?.anchoMm;

  const result = await impresionService.imprimirComanda(prisma, pedidoId, { anchoMm });

  eventBus.publish('impresion.updated', {
    pedidoId: parseInt(pedidoId, 10),
    ok: 0,
    total: result.total
  });

  res.json({
    success: true,
    message: 'Jobs de impresion creados',
    ...result
  });
};

const reimprimirComanda = async (req, res) => {
  return imprimirComanda(req, res);
};

const previewComanda = async (req, res) => {
  const prisma = getPrisma(req);
  const { pedidoId } = req.params;

  const contenido = await impresionService.previewComanda(prisma, pedidoId, req.query);
  res.type('text/plain').send(contenido);
};

const estadoImpresora = async (req, res) => {
  const prisma = getPrisma(req);
  const result = await impresionService.estadoImpresora(prisma);
  res.json(result);
};

const claimJobs = async (req, res) => {
  const prisma = getPrisma(req);
  const result = await impresionService.claimJobs(prisma, req.body);
  res.json(result);
};

const ackJob = async (req, res) => {
  const prisma = getPrisma(req);
  const { id } = req.params;
  const result = await impresionService.ackJob(prisma, id, req.body);

  if (result.alreadyOk) {
    return res.json({ success: true, status: 'OK' });
  }

  if (result.resumen) {
    eventBus.publish('impresion.updated', {
      pedidoId: result.pedidoId,
      ok: result.resumen.ok,
      total: result.resumen.total
    });
  }

  res.json({ success: true });
};

const failJob = async (req, res) => {
  const prisma = getPrisma(req);
  const { id } = req.params;
  const result = await impresionService.failJob(prisma, id, req.body);

  if (result.resumen) {
    eventBus.publish('impresion.updated', {
      pedidoId: result.pedidoId,
      ok: result.resumen.ok,
      total: result.resumen.total
    });
  }

  res.json({ success: true });
};

module.exports = {
  imprimirComanda,
  previewComanda,
  estadoImpresora,
  reimprimirComanda,
  claimJobs,
  ackJob,
  failJob
};
