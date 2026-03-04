const eventBus = require('../services/event-bus');
const { getPrisma } = require('../utils/get-prisma');
const ingredientesService = require('../services/ingredientes.service');

const listar = async (req, res) => {
  const prisma = getPrisma(req);
  const ingredientes = await ingredientesService.listar(prisma, req.query);
  res.json(ingredientes);
};

const obtener = async (req, res) => {
  const prisma = getPrisma(req);
  const ingrediente = await ingredientesService.obtener(prisma, req.params.id);
  res.json(ingrediente);
};

const crear = async (req, res) => {
  const prisma = getPrisma(req);
  const ingrediente = await ingredientesService.crear(prisma, req.body);
  res.status(201).json(ingrediente);
};

const actualizar = async (req, res) => {
  const prisma = getPrisma(req);
  const ingrediente = await ingredientesService.actualizar(prisma, req.params.id, req.body);
  res.json(ingrediente);
};

const registrarMovimiento = async (req, res) => {
  const prisma = getPrisma(req);
  const { ingrediente, events } = await ingredientesService.registrarMovimiento(prisma, req.params.id, req.body);
  events.forEach(event => eventBus.publish(event.topic, event.payload));
  res.json(ingrediente);
};

const ajustarStock = async (req, res) => {
  const prisma = getPrisma(req);
  const { ingrediente, events } = await ingredientesService.ajustarStock(prisma, req.params.id, req.body);
  events.forEach(event => eventBus.publish(event.topic, event.payload));
  res.json(ingrediente);
};

const alertasStock = async (req, res) => {
  const prisma = getPrisma(req);
  const alertas = await ingredientesService.alertasStock(prisma);
  res.json(alertas);
};

const crearLote = async (req, res) => {
  const prisma = getPrisma(req);
  const { lote, events } = await ingredientesService.crearLote(prisma, req.params.id, req.body);
  events.forEach(event => eventBus.publish(event.topic, event.payload));
  res.status(201).json(lote);
};

const listarLotes = async (req, res) => {
  const prisma = getPrisma(req);
  const lotes = await ingredientesService.listarLotes(prisma, req.params.id, req.query);
  res.json(lotes);
};

const alertasVencimiento = async (req, res) => {
  const prisma = getPrisma(req);
  const dias = req.query.dias ? parseInt(req.query.dias) : 7;
  const alertas = await ingredientesService.alertasVencimiento(prisma, dias);
  res.json(alertas);
};

const descartarLote = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await ingredientesService.descartarLote(prisma, parseInt(req.params.loteId));
  res.json(resultado);
};

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  registrarMovimiento,
  ajustarStock,
  alertasStock,
  crearLote,
  listarLotes,
  alertasVencimiento,
  descartarLote
};
