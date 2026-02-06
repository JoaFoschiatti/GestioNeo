const eventBus = require('../services/event-bus');
const { getPrisma } = require('../utils/get-prisma');
const reservasService = require('../services/reservas.service');

const listar = async (req, res) => {
  const prisma = getPrisma(req);
  const reservas = await reservasService.listar(prisma, req.query);
  res.json(reservas);
};

const crear = async (req, res) => {
  const prisma = getPrisma(req);
  const { reserva, events } = await reservasService.crear(prisma, req.body);
  events.forEach(event => eventBus.publish(event.topic, { tenantId: 1, ...event.payload }));
  res.status(201).json(reserva);
};

const actualizar = async (req, res) => {
  const prisma = getPrisma(req);
  const reserva = await reservasService.actualizar(prisma, req.params.id, req.body);
  res.json(reserva);
};

const cambiarEstado = async (req, res) => {
  const prisma = getPrisma(req);
  const { reserva, events } = await reservasService.cambiarEstado(prisma, req.params.id, req.body.estado);
  events.forEach(event => eventBus.publish(event.topic, { tenantId: 1, ...event.payload }));
  res.json(reserva);
};

const reservasProximas = async (req, res) => {
  const prisma = getPrisma(req);
  const reservas = await reservasService.reservasProximas(prisma);
  res.json(reservas);
};

const obtener = async (req, res) => {
  const prisma = getPrisma(req);
  const reserva = await reservasService.obtener(prisma, req.params.id);
  res.json(reserva);
};

// Eliminar reserva
const eliminar = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await reservasService.eliminar(prisma, req.params.id);
  res.json(resultado);
};

module.exports = {
  listar,
  crear,
  actualizar,
  cambiarEstado,
  reservasProximas,
  obtener,
  eliminar
};
