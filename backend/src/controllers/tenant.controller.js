const { getPrisma } = require('../utils/get-prisma');
const tenantService = require('../services/tenant.service');

const obtenerTenant = async (req, res) => {
  const prisma = getPrisma(req);
  const tenant = await tenantService.obtenerTenant(prisma, req.tenantId);
  res.json(tenant);
};

const actualizarTenant = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await tenantService.actualizarTenant(prisma, req.tenantId, req.body);
  res.json(resultado);
};

const verificarSlug = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await tenantService.verificarSlug(prisma, req.tenantId, req.params.slug);
  res.json(resultado);
};

module.exports = {
  obtenerTenant,
  actualizarTenant,
  verificarSlug
};
