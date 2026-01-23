const path = require('path');
const fs = require('fs');

// Use Prisma Client from backend (already generated with schema)
const { PrismaClient } = require(path.join(__dirname, '../backend/node_modules/@prisma/client'));
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const E2E_TENANT_SLUG = 'e2e-test-tenant';
const E2E_USER_EMAIL = 'admin@e2e-test.com';
const E2E_USER_PASSWORD = 'password123';

async function globalSetup() {
  console.log('\n[E2E Setup] Creating test data...');

  // Cleanup any previous test data
  const existingTenant = await prisma.tenant.findUnique({
    where: { slug: E2E_TENANT_SLUG }
  });

  if (existingTenant) {
    console.log('[E2E Setup] Cleaning up previous test tenant...');
    await cleanupTenant(existingTenant.id);
  }

  // Create tenant
  const tenant = await prisma.tenant.create({
    data: {
      slug: E2E_TENANT_SLUG,
      nombre: 'E2E Test Restaurant',
      email: 'e2e@test.com',
      activo: true
    }
  });
  console.log(`[E2E Setup] Created tenant: ${tenant.slug}`);

  // Create admin user
  const passwordHash = await bcrypt.hash(E2E_USER_PASSWORD, 4);
  const usuario = await prisma.usuario.create({
    data: {
      tenantId: tenant.id,
      email: E2E_USER_EMAIL,
      password: passwordHash,
      nombre: 'Admin E2E',
      rol: 'ADMIN',
      activo: true
    }
  });
  console.log(`[E2E Setup] Created user: ${usuario.email}`);

  // Create category
  const categoria = await prisma.categoria.create({
    data: {
      tenantId: tenant.id,
      nombre: 'Hamburguesas',
      orden: 1,
      activa: true
    }
  });
  console.log(`[E2E Setup] Created category: ${categoria.nombre}`);

  // Create product
  const producto = await prisma.producto.create({
    data: {
      tenantId: tenant.id,
      nombre: 'Hamburguesa Test',
      descripcion: 'Hamburguesa para E2E testing',
      precio: 5500,
      categoriaId: categoria.id,
      disponible: true
    }
  });
  console.log(`[E2E Setup] Created product: ${producto.nombre}`);

  // Create table
  const mesa = await prisma.mesa.create({
    data: {
      tenantId: tenant.id,
      numero: 1,
      capacidad: 4,
      estado: 'LIBRE',
      activa: true
    }
  });
  console.log(`[E2E Setup] Created table: Mesa ${mesa.numero}`);

  // Save test data for tests
  const testData = {
    tenantId: tenant.id,
    tenantSlug: E2E_TENANT_SLUG,
    userId: usuario.id,
    userEmail: E2E_USER_EMAIL,
    userPassword: E2E_USER_PASSWORD,
    categoryId: categoria.id,
    productId: producto.id,
    productName: producto.nombre,
    tableId: mesa.id,
    tableNumber: mesa.numero
  };

  const dataPath = path.join(__dirname, '.e2e-test-data.json');
  fs.writeFileSync(dataPath, JSON.stringify(testData, null, 2));
  console.log(`[E2E Setup] Test data saved to ${dataPath}`);

  await prisma.$disconnect();
  console.log('[E2E Setup] Complete!\n');
}

async function cleanupTenant(tenantId) {
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
}

module.exports = globalSetup;
