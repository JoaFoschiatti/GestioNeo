const { getPrisma } = require('../utils/get-prisma');
const cierresService = require('../services/cierres.service');

const obtenerActual = async (req, res) => {
  const prisma = getPrisma(req);
  const result = await cierresService.obtenerActual(prisma);
  res.json(result);
};

const abrirCaja = async (req, res) => {
  const prisma = getPrisma(req);
  const caja = await cierresService.abrirCaja(prisma, req.usuario.id, req.body.fondoInicial);
  res.status(201).json(caja);
};

const cerrarCaja = async (req, res) => {
  const prisma = getPrisma(req);
  const result = await cierresService.cerrarCaja(prisma, req.params.id, req.body.efectivoFisico, req.body.observaciones);
  res.json(result);
};

const listar = async (req, res) => {
  const prisma = getPrisma(req);
  const cierres = await cierresService.listar(prisma, req.query);
  res.json(cierres);
};

const resumenActual = async (req, res) => {
  const prisma = getPrisma(req);
  const resumen = await cierresService.resumenActual(prisma);
  res.json(resumen);
};

module.exports = {
  obtenerActual,
  abrirCaja,
  cerrarCaja,
  listar,
  resumenActual
};
