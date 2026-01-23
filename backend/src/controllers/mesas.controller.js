const { getPrisma } = require('../utils/get-prisma');
const mesasService = require('../services/mesas.service');

const listar = async (req, res) => {
  const prisma = getPrisma(req);
  const mesas = await mesasService.listar(prisma, req.query);
  res.json(mesas);
};

const obtener = async (req, res) => {
  const prisma = getPrisma(req);
  const mesa = await mesasService.obtener(prisma, req.params.id);
  res.json(mesa);
};

const crear = async (req, res) => {
  const prisma = getPrisma(req);
  const mesa = await mesasService.crear(prisma, req.body);
  res.status(201).json(mesa);
};

const actualizar = async (req, res) => {
  const prisma = getPrisma(req);
  const mesa = await mesasService.actualizar(prisma, req.params.id, req.body);
  res.json(mesa);
};

const cambiarEstado = async (req, res) => {
  const prisma = getPrisma(req);
  const mesa = await mesasService.cambiarEstado(prisma, req.params.id, req.body.estado);
  res.json(mesa);
};

const eliminar = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await mesasService.eliminar(prisma, req.params.id);
  res.json(resultado);
};

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  cambiarEstado,
  eliminar
};
