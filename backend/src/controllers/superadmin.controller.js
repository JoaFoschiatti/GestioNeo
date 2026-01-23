const { prisma } = require('../db/prisma');
const superadminService = require('../services/superadmin.service');

const listarTenants = async (req, res) => {
  const result = await superadminService.listarTenants(prisma, req.query);
  res.json(result);
};

const obtenerTenant = async (req, res) => {
  const tenant = await superadminService.obtenerTenant(prisma, req.params.id);
  res.json(tenant);
};

const toggleActivo = async (req, res) => {
  const result = await superadminService.toggleActivo(prisma, req.params.id, req.body.activo);
  res.json(result);
};

const obtenerMetricas = async (req, res) => {
  const result = await superadminService.obtenerMetricas(prisma, req.params.id);
  res.json(result);
};

const obtenerMetricasGlobales = async (_req, res) => {
  const result = await superadminService.obtenerMetricasGlobales(prisma);
  res.json(result);
};

module.exports = {
  listarTenants,
  obtenerTenant,
  toggleActivo,
  obtenerMetricas,
  obtenerMetricasGlobales
};

