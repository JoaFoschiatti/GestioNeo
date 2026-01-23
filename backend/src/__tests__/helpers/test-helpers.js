const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../../db/prisma');

const uniqueId = (prefix = 'test') => {
  const worker = process.env.JEST_WORKER_ID || '0';
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${worker}-${Date.now()}-${rand}`;
};

const ensureTestEnv = () => {
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'test-secret';
  if (!process.env.JWT_EXPIRES_IN) process.env.JWT_EXPIRES_IN = '1h';
};

const createTenant = async (overrides = {}) => {
  const slug = overrides.slug || uniqueId('tenant');

  return prisma.tenant.create({
    data: {
      slug,
      nombre: overrides.nombre || `Tenant ${slug}`,
      email: overrides.email || `${slug}@example.com`,
      activo: overrides.activo ?? true,
      ...overrides
    }
  });
};

const createUsuario = async (tenantId, overrides = {}) => {
  ensureTestEnv();

  const email = overrides.email || `${uniqueId('user')}@example.com`;
  const passwordPlano = overrides.passwordPlano || 'password';
  const passwordHash = await bcrypt.hash(passwordPlano, 4);

  return prisma.usuario.create({
    data: {
      tenantId,
      email,
      password: passwordHash,
      nombre: overrides.nombre || 'Usuario Test',
      rol: overrides.rol || 'ADMIN',
      activo: overrides.activo ?? true
    }
  });
};

const signTokenForUser = (usuario, overrides = {}) => {
  ensureTestEnv();

  const payload = {
    id: usuario.id,
    ...(overrides.payload || {})
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: overrides.expiresIn || process.env.JWT_EXPIRES_IN || '1h'
  });
};

const authHeader = (token) => `Bearer ${token}`;

const cleanupTenantData = async (tenantId) => {
  if (!tenantId) return;

  await prisma.pedidoItemModificador.deleteMany({ where: { tenantId } });
  await prisma.productoModificador.deleteMany({ where: { tenantId } });
  await prisma.productoIngrediente.deleteMany({ where: { tenantId } });
  await prisma.transaccionMercadoPago.deleteMany({ where: { tenantId } });
  await prisma.printJob.deleteMany({ where: { tenantId } });
  await prisma.pago.deleteMany({ where: { tenantId } });
  await prisma.pedidoItem.deleteMany({ where: { tenantId } });
  await prisma.movimientoStock.deleteMany({ where: { tenantId } });
  await prisma.pedido.deleteMany({ where: { tenantId } });
  await prisma.reserva.deleteMany({ where: { tenantId } });
  await prisma.mesa.deleteMany({ where: { tenantId } });
  await prisma.cierreCaja.deleteMany({ where: { tenantId } });
  await prisma.configuracion.deleteMany({ where: { tenantId } });
  await prisma.mercadoPagoConfig.deleteMany({ where: { tenantId } });
  await prisma.emailVerificacion.deleteMany({ where: { tenantId } });
  await prisma.fichaje.deleteMany({ where: { tenantId } });
  await prisma.liquidacion.deleteMany({ where: { tenantId } });
  await prisma.empleado.deleteMany({ where: { tenantId } });
  await prisma.usuario.deleteMany({ where: { tenantId } });
  await prisma.producto.deleteMany({ where: { tenantId } });
  await prisma.categoria.deleteMany({ where: { tenantId } });
  await prisma.modificador.deleteMany({ where: { tenantId } });
  await prisma.ingrediente.deleteMany({ where: { tenantId } });

  await prisma.tenant.delete({ where: { id: tenantId } });
};

module.exports = {
  prisma,
  uniqueId,
  ensureTestEnv,
  createTenant,
  createUsuario,
  signTokenForUser,
  authHeader,
  cleanupTenantData
};

