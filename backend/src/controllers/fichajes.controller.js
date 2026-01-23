const { getPrisma } = require('../utils/get-prisma');
const fichajesService = require('../services/fichajes.service');

const listar = async (req, res) => {
  const prisma = getPrisma(req);
  const fichajes = await fichajesService.listar(prisma, req.query);
  res.json(fichajes);
};

const registrarEntrada = async (req, res) => {
  const prisma = getPrisma(req);
  const fichaje = await fichajesService.registrarEntrada(prisma, req.body.empleadoId);
  res.status(201).json(fichaje);
};

const registrarSalida = async (req, res) => {
  const prisma = getPrisma(req);
  const fichaje = await fichajesService.registrarSalida(prisma, req.body.empleadoId);
  res.json(fichaje);
};

const estadoEmpleado = async (req, res) => {
  const prisma = getPrisma(req);
  const estado = await fichajesService.estadoEmpleado(prisma, req.params.empleadoId);
  res.json(estado);
};

const calcularHoras = async (req, res) => {
  const prisma = getPrisma(req);
  const reporte = await fichajesService.calcularHoras(prisma, req.params.empleadoId, req.query.fechaDesde, req.query.fechaHasta);
  res.json(reporte);
};

const editar = async (req, res) => {
  const prisma = getPrisma(req);
  const fichaje = await fichajesService.editar(prisma, req.params.id, req.body);
  res.json(fichaje);
};

module.exports = {
  listar,
  registrarEntrada,
  registrarSalida,
  estadoEmpleado,
  calcularHoras,
  editar
};
