const { getPrisma } = require('../utils/get-prisma');
const eventBus = require('../services/event-bus');
const comprobantesService = require('../services/comprobantes.service');

const emitirComprobante = async (req, res) => {
  const prisma = getPrisma(req);
  const comprobante = await comprobantesService.emitirComprobante(prisma, req.body);

  eventBus.publish('comprobante.created', {
    id: comprobante.id,
    pedidoId: comprobante.pedidoId,
    tipoComprobante: comprobante.tipoComprobante,
    cae: comprobante.cae,
    estado: comprobante.estado
  });

  res.status(201).json(comprobante);
};

const emitirConsumidorFinal = async (req, res) => {
  const prisma = getPrisma(req);
  const comprobante = await comprobantesService.emitirConsumidorFinal(prisma, req.body);

  eventBus.publish('comprobante.created', {
    id: comprobante.id,
    pedidoId: comprobante.pedidoId,
    tipoComprobante: comprobante.tipoComprobante,
    cae: comprobante.cae,
    estado: comprobante.estado
  });

  res.status(201).json(comprobante);
};

const listarComprobantes = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await comprobantesService.listarComprobantes(prisma, req.query);
  res.json(resultado);
};

const obtenerComprobante = async (req, res) => {
  const prisma = getPrisma(req);
  const comprobante = await comprobantesService.obtenerComprobante(prisma, req.params.id);
  res.json(comprobante);
};

const obtenerPorPedido = async (req, res) => {
  const prisma = getPrisma(req);
  const comprobantes = await comprobantesService.obtenerComprobantePorPedido(prisma, req.params.pedidoId);
  res.json(comprobantes);
};

const reintentarComprobante = async (req, res) => {
  const prisma = getPrisma(req);
  const comprobante = await comprobantesService.reintentarComprobante(prisma, req.params.id);

  eventBus.publish('comprobante.updated', {
    id: comprobante.id,
    cae: comprobante.cae,
    estado: comprobante.estado
  });

  res.json(comprobante);
};

module.exports = {
  emitirComprobante,
  emitirConsumidorFinal,
  listarComprobantes,
  obtenerComprobante,
  obtenerPorPedido,
  reintentarComprobante
};
