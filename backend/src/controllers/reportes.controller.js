const { getPrisma } = require('../utils/get-prisma');
const reportesService = require('../services/reportes.service');

const dashboard = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await reportesService.dashboard(prisma, req.usuario.tenantId);
  res.json(resultado);
};

const ventasReporte = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await reportesService.ventasReporte(prisma, req.usuario.tenantId, req.query);
  res.json(resultado);
};

const productosMasVendidos = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await reportesService.productosMasVendidos(prisma, req.usuario.tenantId, req.query);
  res.json(resultado);
};

const ventasPorMozo = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await reportesService.ventasPorMozo(prisma, req.usuario.tenantId, req.query);
  res.json(resultado);
};

const inventarioReporte = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await reportesService.inventarioReporte(prisma, req.usuario.tenantId);
  res.json(resultado);
};

const sueldosReporte = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await reportesService.sueldosReporte(prisma, req.usuario.tenantId, req.query);
  res.json(resultado);
};

// ==========================================
// REPORTES DE VARIANTES DE PRODUCTOS
// ==========================================

const ventasPorProductoBase = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await reportesService.ventasPorProductoBase(prisma, req.usuario.tenantId, req.query);
  res.json(resultado);
};

const consumoInsumos = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await reportesService.consumoInsumos(prisma, req.usuario.tenantId, req.query);
  res.json(resultado);
};

module.exports = {
  dashboard,
  ventasReporte,
  productosMasVendidos,
  ventasPorMozo,
  inventarioReporte,
  sueldosReporte,
  ventasPorProductoBase,
  consumoInsumos
};
