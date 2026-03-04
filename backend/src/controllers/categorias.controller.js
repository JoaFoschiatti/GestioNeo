const { getPrisma } = require('../utils/get-prisma');
const categoriasService = require('../services/categorias.service');

const listar = async (req, res) => {
  const prisma = getPrisma(req);
  const categorias = await categoriasService.listar(prisma, req.query);
  res.json(categorias);
};

const listarPublicas = async (req, res) => {
  const prisma = getPrisma(req);
  const categorias = await categoriasService.listarPublicas(prisma);
  res.json(categorias);
};

const crear = async (req, res) => {
  const prisma = getPrisma(req);
  const categoria = await categoriasService.crear(prisma, req.body);
  res.status(201).json(categoria);
};

const actualizar = async (req, res) => {
  const prisma = getPrisma(req);
  const categoria = await categoriasService.actualizar(prisma, req.params.id, req.body);
  res.json(categoria);
};

const eliminar = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await categoriasService.eliminar(prisma, req.params.id);
  res.json(resultado);
};

module.exports = {
  listar,
  listarPublicas,
  crear,
  actualizar,
  eliminar
};
