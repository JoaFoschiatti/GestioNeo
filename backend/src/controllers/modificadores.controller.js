const { getPrisma } = require('../utils/get-prisma');
const modificadoresService = require('../services/modificadores.service');

const listar = async (req, res) => {
  const prisma = getPrisma(req);
  const modificadores = await modificadoresService.listar(prisma, req.query);
  res.json(modificadores);
};

const obtener = async (req, res) => {
  const prisma = getPrisma(req);
  const modificador = await modificadoresService.obtener(prisma, req.params.id);
  res.json(modificador);
};

const crear = async (req, res) => {
  const prisma = getPrisma(req);
  const modificador = await modificadoresService.crear(prisma, req.body);
  res.status(201).json(modificador);
};

const actualizar = async (req, res) => {
  const prisma = getPrisma(req);
  const modificador = await modificadoresService.actualizar(prisma, req.params.id, req.body);
  res.json(modificador);
};

const eliminar = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await modificadoresService.eliminar(prisma, req.params.id);
  res.json(resultado);
};

const asignarAProducto = async (req, res) => {
  const prisma = getPrisma(req);
  const producto = await modificadoresService.asignarAProducto(prisma, req.params.productoId, req.body.modificadorIds);
  res.json(producto);
};

const modificadoresDeProducto = async (req, res) => {
  const prisma = getPrisma(req);
  const modificadores = await modificadoresService.modificadoresDeProducto(prisma, req.params.productoId);
  res.json(modificadores);
};

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
  asignarAProducto,
  modificadoresDeProducto
};
