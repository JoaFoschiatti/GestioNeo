const { getPrisma } = require('../utils/get-prisma');
const productosService = require('../services/productos.service');

const listar = async (req, res) => {
  const prisma = getPrisma(req);
  const productos = await productosService.listar(prisma, req.query);
  res.json(productos);
};

const listarConVariantes = async (req, res) => {
  const prisma = getPrisma(req);
  const productos = await productosService.listarConVariantes(prisma, req.query);
  res.json(productos);
};

const obtener = async (req, res) => {
  const prisma = getPrisma(req);
  const producto = await productosService.obtener(prisma, req.params.id);
  res.json(producto);
};

const crear = async (req, res) => {
  const prisma = getPrisma(req);
  const producto = await productosService.crear(prisma, req.body, req.file);
  res.status(201).json(producto);
};

const actualizar = async (req, res) => {
  const prisma = getPrisma(req);
  const producto = await productosService.actualizar(prisma, req.params.id, req.body, req.file);
  res.json(producto);
};

const cambiarDisponibilidad = async (req, res) => {
  const prisma = getPrisma(req);
  const producto = await productosService.cambiarDisponibilidad(prisma, req.params.id, req.body.disponible);
  res.json(producto);
};

const eliminar = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await productosService.eliminar(prisma, req.params.id);
  res.json(resultado);
};

const crearVariante = async (req, res) => {
  const prisma = getPrisma(req);
  const variante = await productosService.crearVariante(prisma, req.params.id, req.body);
  res.status(201).json(variante);
};

const agruparComoVariantes = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await productosService.agruparComoVariantes(prisma, req.body);
  res.json(resultado);
};

const desagruparVariante = async (req, res) => {
  const prisma = getPrisma(req);
  const producto = await productosService.desagruparVariante(prisma, req.params.id);
  res.json(producto);
};

const actualizarVariante = async (req, res) => {
  const prisma = getPrisma(req);
  const variante = await productosService.actualizarVariante(prisma, req.params.id, req.body);
  res.json(variante);
};

module.exports = {
  listar,
  listarConVariantes,
  obtener,
  crear,
  actualizar,
  cambiarDisponibilidad,
  eliminar,
  crearVariante,
  agruparComoVariantes,
  desagruparVariante,
  actualizarVariante
};
