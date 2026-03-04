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

const createUsuario = async (overrides = {}) => {
  ensureTestEnv();

  const email = overrides.email || `${uniqueId('user')}@example.com`;
  const passwordPlano = overrides.passwordPlano || 'password';
  const passwordHash = await bcrypt.hash(passwordPlano, 4);

  return prisma.usuario.create({
    data: {
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

const cleanupTestData = async () => {
  // Order respects FK constraints — children first, parents last
  await prisma.pedidoItemModificador.deleteMany({});
  await prisma.productoModificador.deleteMany({});
  await prisma.productoIngrediente.deleteMany({});
  await prisma.transaccionMercadoPago.deleteMany({});
  await prisma.transferenciaEntrante.deleteMany({});
  await prisma.printJob.deleteMany({});
  await prisma.pago.deleteMany({});
  await prisma.pedidoItem.deleteMany({});
  await prisma.auditoriaAnulacion.deleteMany({});
  await prisma.movimientoStock.deleteMany({});
  await prisma.loteIngrediente.deleteMany({});
  await prisma.pedido.deleteMany({});
  await prisma.reserva.deleteMany({});
  await prisma.mesa.deleteMany({});
  await prisma.repartoPropina.deleteMany({});
  await prisma.cierreCaja.deleteMany({});
  await prisma.configuracion.deleteMany({});
  await prisma.emailVerificacion.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.fichaje.deleteMany({});
  await prisma.liquidacion.deleteMany({});
  await prisma.empleado.deleteMany({});
  await prisma.usuario.deleteMany({});
  await prisma.producto.deleteMany({});
  await prisma.categoria.deleteMany({});
  await prisma.modificador.deleteMany({});
  await prisma.ingrediente.deleteMany({});
  await prisma.pagoSuscripcion.deleteMany({});
  // Do NOT delete negocio, suscripcion, syncTransferencias, mercadoPagoConfig (singletons)
};

const ensureActiveSuscripcion = async () => {
  await prisma.suscripcion.upsert({
    where: { id: 1 },
    update: { estado: 'ACTIVA', fechaVencimiento: new Date(2099, 0, 1) },
    create: { estado: 'ACTIVA', fechaVencimiento: new Date(2099, 0, 1), precioMensual: 0 }
  });
};

module.exports = {
  prisma,
  uniqueId,
  ensureTestEnv,
  createUsuario,
  signTokenForUser,
  authHeader,
  cleanupTestData,
  ensureActiveSuscripcion
};
