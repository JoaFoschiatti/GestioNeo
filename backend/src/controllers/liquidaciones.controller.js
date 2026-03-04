const { getPrisma } = require('../utils/get-prisma');
const liquidacionesService = require('../services/liquidaciones.service');

const listar = async (req, res) => {
  const prisma = getPrisma(req);
  const liquidaciones = await liquidacionesService.listar(prisma, req.query);
  res.json(liquidaciones);
};

const obtener = async (req, res) => {
  const prisma = getPrisma(req);
  const liquidacion = await liquidacionesService.obtener(prisma, req.params.id);
  res.json(liquidacion);
};

const calcular = async (req, res) => {
  const prisma = getPrisma(req);
  const result = await liquidacionesService.calcular(prisma, req.body.empleadoId, req.body.fechaDesde, req.body.fechaHasta);
  res.json(result);
};

const crear = async (req, res) => {
  const prisma = getPrisma(req);
  const liquidacion = await liquidacionesService.crear(prisma, req.body);
  res.status(201).json(liquidacion);
};

const marcarPagada = async (req, res) => {
  const prisma = getPrisma(req);
  const liquidacion = await liquidacionesService.marcarPagada(prisma, req.params.id);
  res.json(liquidacion);
};

const eliminar = async (req, res) => {
  const prisma = getPrisma(req);
  const result = await liquidacionesService.eliminar(prisma, req.params.id);
  res.json(result);
};

module.exports = {
  listar,
  obtener,
  calcular,
  crear,
  marcarPagada,
  eliminar
};
