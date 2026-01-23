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
  events.forEach(event => eventBus.publish(event.topic, { tenantId: req.tenantId, ...event.payload }));
  res.json(ingrediente);
};

const ajustarStock = async (req, res) => {
  const prisma = getPrisma(req);
  const { ingrediente, events } = await ingredientesService.ajustarStock(prisma, req.params.id, req.body);
  events.forEach(event => eventBus.publish(event.topic, { tenantId: req.tenantId, ...event.payload }));
  res.json(ingrediente);
};

const alertasStock = async (req, res) => {
  const prisma = getPrisma(req);
  const alertas = await ingredientesService.alertasStock(prisma);
  res.json(alertas);
};

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  registrarMovimiento,
  ajustarStock,
  alertasStock
};
