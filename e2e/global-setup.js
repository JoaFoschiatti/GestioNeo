const path = require('path');
const fs = require('fs');
const { PrismaClient } = require(path.join(__dirname, '../backend/node_modules/@prisma/client'));
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const E2E_USER_EMAIL = 'e2e-admin@test.com';
const E2E_USER_PASSWORD = 'password123';
const E2E_MOZO_EMAIL = 'e2e-mozo@test.com';
const E2E_MOZO_PASSWORD = 'password123';
const E2E_COCINERO_EMAIL = 'e2e-cocinero@test.com';
const E2E_COCINERO_PASSWORD = 'password123';
const E2E_DELIVERY_EMAIL = 'e2e-delivery@test.com';
const E2E_DELIVERY_PASSWORD = 'password123';

async function globalSetup() {
  console.log('\n[E2E Setup] Creating test data...');

  // Cleanup any previous E2E data
  await cleanupE2eData();

  // Ensure Negocio singleton exists
  const negocio = await prisma.negocio.findFirst();
  if (!negocio) {
    await prisma.negocio.create({
      data: { id: 1, nombre: 'E2E Test Restaurant', email: 'e2e@test.com' }
    });
    console.log('[E2E Setup] Created Negocio singleton');
  }

  // Ensure subscription is active so write flows are not blocked in read-only mode
  const ahora = new Date();
  const proximoCobro = new Date(ahora);
  proximoCobro.setDate(proximoCobro.getDate() + 30);
  const vencimiento = new Date(ahora);
  vencimiento.setDate(vencimiento.getDate() + 365);

  await prisma.suscripcion.upsert({
    where: { id: 1 },
    update: {
      estado: 'ACTIVA',
      fechaInicio: ahora,
      fechaProximoCobro: proximoCobro,
      fechaVencimiento: vencimiento,
      ultimoPagoExitoso: ahora,
      intentosFallidos: 0,
      precioMensual: 37000,
      moneda: 'ARS'
    },
    create: {
      id: 1,
      estado: 'ACTIVA',
      fechaInicio: ahora,
      fechaProximoCobro: proximoCobro,
      fechaVencimiento: vencimiento,
      ultimoPagoExitoso: ahora,
      intentosFallidos: 0,
      precioMensual: 37000,
      moneda: 'ARS'
    }
  });
  console.log('[E2E Setup] Ensured active subscription');

  // Create E2E users (admin + role-specific accounts)
  const passwordHash = await bcrypt.hash(E2E_USER_PASSWORD, 4);
  const usuarioAdmin = await prisma.usuario.create({
    data: {
      email: E2E_USER_EMAIL,
      password: passwordHash,
      nombre: 'Admin E2E',
      rol: 'ADMIN',
      activo: true
    }
  });
  const usuarioMozo = await prisma.usuario.create({
    data: {
      email: E2E_MOZO_EMAIL,
      password: passwordHash,
      nombre: 'Mozo E2E',
      rol: 'MOZO',
      activo: true
    }
  });
  const usuarioCocinero = await prisma.usuario.create({
    data: {
      email: E2E_COCINERO_EMAIL,
      password: passwordHash,
      nombre: 'Cocinero E2E',
      rol: 'COCINERO',
      activo: true
    }
  });
  const usuarioDelivery = await prisma.usuario.create({
    data: {
      email: E2E_DELIVERY_EMAIL,
      password: passwordHash,
      nombre: 'Delivery E2E',
      rol: 'DELIVERY',
      activo: true
    }
  });
  console.log(`[E2E Setup] Created users: ${usuarioAdmin.email}, ${usuarioMozo.email}, ${usuarioCocinero.email}, ${usuarioDelivery.email}`);

  // Create E2E category
  const categoria = await prisma.categoria.create({
    data: {
      nombre: 'E2E Hamburguesas',
      orden: 100,
      activa: true
    }
  });
  console.log(`[E2E Setup] Created category: ${categoria.nombre}`);

  // Create E2E product
  const producto = await prisma.producto.create({
    data: {
      nombre: 'E2E Hamburguesa Test',
      descripcion: 'Hamburguesa para E2E testing',
      precio: 5500,
      categoriaId: categoria.id,
      disponible: true
    }
  });
  console.log(`[E2E Setup] Created product: ${producto.nombre}`);

  // Create additional E2E table so reservation tests can pick an alternate mesa by index
  await prisma.mesa.create({
    data: {
      numero: 97,
      capacidad: 4,
      estado: 'LIBRE',
      activa: true
    }
  });

  // Create E2E primary table (high number to avoid collisions)
  const mesa = await prisma.mesa.create({
    data: {
      numero: 99,
      capacidad: 4,
      estado: 'LIBRE',
      activa: true
    }
  });
  console.log(`[E2E Setup] Created table: Mesa ${mesa.numero}`);

  // Create E2E employee
  const empleado = await prisma.empleado.create({
    data: {
      nombre: 'Test',
      apellido: 'E2E',
      dni: '99999999',
      telefono: '11-0000-0000',
      rol: 'MOZO',
      tarifaHora: 1500
    }
  });
  console.log(`[E2E Setup] Created employee: ${empleado.nombre} ${empleado.apellido}`);

  // Create E2E ingredient
  const ingrediente = await prisma.ingrediente.create({
    data: {
      nombre: 'E2E Ingrediente Test',
      unidad: 'kg',
      stockActual: 50,
      stockMinimo: 10,
      costo: 500
    }
  });
  console.log(`[E2E Setup] Created ingredient: ${ingrediente.nombre}`);

  // Create E2E modifier
  const modificador = await prisma.modificador.create({
    data: {
      nombre: 'E2E Extra Queso',
      precio: 500,
      tipo: 'ADICION',
      activo: true
    }
  });
  console.log(`[E2E Setup] Created modifier: ${modificador.nombre}`);

  // Save test data for tests
  const testData = {
    userId: usuarioAdmin.id,
    userEmail: E2E_USER_EMAIL,
    userPassword: E2E_USER_PASSWORD,
    adminUserId: usuarioAdmin.id,
    adminEmail: E2E_USER_EMAIL,
    adminPassword: E2E_USER_PASSWORD,
    mozoUserId: usuarioMozo.id,
    mozoEmail: E2E_MOZO_EMAIL,
    mozoPassword: E2E_MOZO_PASSWORD,
    cocineroUserId: usuarioCocinero.id,
    cocineroEmail: E2E_COCINERO_EMAIL,
    cocineroPassword: E2E_COCINERO_PASSWORD,
    deliveryUserId: usuarioDelivery.id,
    deliveryEmail: E2E_DELIVERY_EMAIL,
    deliveryPassword: E2E_DELIVERY_PASSWORD,
    categoryId: categoria.id,
    categoryName: categoria.nombre,
    productId: producto.id,
    productName: producto.nombre,
    productPrice: 5500,
    tableId: mesa.id,
    tableNumber: mesa.numero,
    empleadoId: empleado.id,
    empleadoNombre: `${empleado.nombre} ${empleado.apellido}`,
    empleadoDni: empleado.dni,
    ingredienteId: ingrediente.id,
    ingredienteName: ingrediente.nombre,
    modificadorId: modificador.id,
    modificadorName: modificador.nombre
  };

  const dataPath = path.join(__dirname, '.e2e-test-data.json');
  fs.writeFileSync(dataPath, JSON.stringify(testData, null, 2));
  console.log(`[E2E Setup] Test data saved to ${dataPath}`);

  await prisma.$disconnect();
  console.log('[E2E Setup] Complete!\n');
}

async function cleanupE2eData() {
  console.log('[E2E Setup] Cleaning up previous E2E data...');

  try {
    // Find all E2E user IDs for cascading deletes
    const e2eUsers = await prisma.usuario.findMany({
      where: { email: { startsWith: 'e2e-' } },
      select: { id: true }
    });
    const e2eUserIds = e2eUsers.map(u => u.id);

    // Find E2E mesa IDs (numero >= 90)
    const e2eMesas = await prisma.mesa.findMany({ where: { numero: { gte: 90 } }, select: { id: true } });
    const e2eMesaIds = e2eMesas.map(m => m.id);

    // Find E2E empleado IDs
    const e2eEmpleados = await prisma.empleado.findMany({ where: { dni: { startsWith: '999' } }, select: { id: true } });
    const e2eEmpleadoIds = e2eEmpleados.map(e => e.id);

    // Find E2E ingrediente IDs
    const e2eIngredientes = await prisma.ingrediente.findMany({ where: { nombre: { startsWith: 'E2E' } }, select: { id: true } });
    const e2eIngredienteIds = e2eIngredientes.map(i => i.id);

    // Find E2E producto IDs
    const e2eProductos = await prisma.producto.findMany({ where: { nombre: { startsWith: 'E2E' } }, select: { id: true } });
    const e2eProductoIds = e2eProductos.map(p => p.id);

    // Build pedido filter (by user or by mesa)
    const pedidoFilter = { OR: [] };
    if (e2eUserIds.length > 0) pedidoFilter.OR.push({ usuarioId: { in: e2eUserIds } });
    if (e2eMesaIds.length > 0) pedidoFilter.OR.push({ mesaId: { in: e2eMesaIds } });

    // Find E2E pedido IDs
    let e2ePedidoIds = [];
    if (pedidoFilter.OR.length > 0) {
      const e2ePedidos = await prisma.pedido.findMany({ where: pedidoFilter, select: { id: true } });
      e2ePedidoIds = e2ePedidos.map(p => p.id);
    }

    // Delete in FK dependency order
    if (e2ePedidoIds.length > 0) {
      // PedidoItemModificador via PedidoItem
      const pedidoItemIds = (await prisma.pedidoItem.findMany({
        where: { pedidoId: { in: e2ePedidoIds } }, select: { id: true }
      })).map(pi => pi.id);

      if (pedidoItemIds.length > 0) {
        await prisma.pedidoItemModificador.deleteMany({ where: { pedidoItemId: { in: pedidoItemIds } } });
      }

      await prisma.printJob.deleteMany({ where: { pedidoId: { in: e2ePedidoIds } } });
      await prisma.pago.deleteMany({ where: { pedidoId: { in: e2ePedidoIds } } });
      await prisma.pedidoItem.deleteMany({ where: { pedidoId: { in: e2ePedidoIds } } });
      await prisma.movimientoStock.deleteMany({ where: { pedidoId: { in: e2ePedidoIds } } });
      await prisma.pedido.deleteMany({ where: { id: { in: e2ePedidoIds } } });
    }

    // Delete stock movements by ingredient
    if (e2eIngredienteIds.length > 0) {
      await prisma.movimientoStock.deleteMany({ where: { ingredienteId: { in: e2eIngredienteIds } } });
    }

    // Delete reservas by mesa OR by E2E client name
    await prisma.reserva.deleteMany({
      where: {
        OR: [
          ...(e2eMesaIds.length > 0 ? [{ mesaId: { in: e2eMesaIds } }] : []),
          { clienteNombre: { startsWith: 'Cliente E2E' } },
          { clienteNombre: { startsWith: 'E2E' } }
        ]
      }
    });

    // Delete fichajes and liquidaciones by empleado
    if (e2eEmpleadoIds.length > 0) {
      await prisma.fichaje.deleteMany({ where: { empleadoId: { in: e2eEmpleadoIds } } });
      await prisma.liquidacion.deleteMany({ where: { empleadoId: { in: e2eEmpleadoIds } } });
    }

    // Delete cierres by user
    if (e2eUserIds.length > 0) {
      await prisma.cierreCaja.deleteMany({ where: { usuarioId: { in: e2eUserIds } } });
    }

    // Delete product relations
    if (e2eProductoIds.length > 0) {
      await prisma.productoModificador.deleteMany({ where: { productoId: { in: e2eProductoIds } } });
      await prisma.productoIngrediente.deleteMany({ where: { productoId: { in: e2eProductoIds } } });
    }

    // Delete entities
    await prisma.producto.deleteMany({ where: { nombre: { startsWith: 'E2E' } } });
    await prisma.categoria.deleteMany({ where: { nombre: { startsWith: 'E2E' } } });
    await prisma.modificador.deleteMany({ where: { nombre: { startsWith: 'E2E' } } });
    await prisma.mesa.deleteMany({ where: { numero: { gte: 90 } } });
    await prisma.empleado.deleteMany({ where: { dni: { startsWith: '999' } } });
    await prisma.ingrediente.deleteMany({ where: { nombre: { startsWith: 'E2E' } } });

    // Delete user last (after all references)
    if (e2eUserIds.length > 0) {
      await prisma.refreshToken.deleteMany({ where: { usuarioId: { in: e2eUserIds } } });
      await prisma.emailVerificacion.deleteMany({ where: { usuarioId: { in: e2eUserIds } } });
      await prisma.usuario.deleteMany({ where: { id: { in: e2eUserIds } } });
    }

    console.log('[E2E Setup] Cleanup complete');
  } catch (error) {
    console.log(`[E2E Setup] Cleanup note: ${error.message}`);
  }
}

module.exports = globalSetup;
