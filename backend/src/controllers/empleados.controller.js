const { getPrisma } = require('../utils/get-prisma');
const empleadosService = require('../services/empleados.service');

const listar = async (req, res) => {
  const prisma = getPrisma(req);
  const empleados = await empleadosService.listar(prisma, req.query);
  res.json(empleados);
};

const obtener = async (req, res) => {
  const prisma = getPrisma(req);
  const empleado = await empleadosService.obtener(prisma, req.params.id);
  res.json(empleado);
};

const crear = async (req, res) => {
  const prisma = getPrisma(req);
  const empleado = await empleadosService.crear(prisma, req.body);
  res.status(201).json(empleado);
};

const actualizar = async (req, res) => {
  const prisma = getPrisma(req);
  const empleado = await empleadosService.actualizar(prisma, req.params.id, req.body);
  res.json(empleado);
};

const eliminar = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await empleadosService.eliminar(prisma, req.params.id);
  res.json(resultado);
};

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar
};
