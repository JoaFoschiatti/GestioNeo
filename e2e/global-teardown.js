const path = require('path');
const fs = require('fs');
const { PrismaClient } = require(path.join(__dirname, '../backend/node_modules/@prisma/client'));

const prisma = new PrismaClient();

async function globalTeardown() {
  console.log('\n[E2E Teardown] Cleaning up test data...');

  const dataPath = path.join(__dirname, '.e2e-test-data.json');

  if (!fs.existsSync(dataPath)) {
    console.log('[E2E Teardown] No test data file found, skipping cleanup');
    return;
  }

  const testData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  try {
    // Find all pedido IDs created by E2E user or on E2E mesas
    const pedidoFilter = { OR: [] };
    if (testData.userId) pedidoFilter.OR.push({ usuarioId: testData.userId });
    if (testData.tableId) pedidoFilter.OR.push({ mesaId: testData.tableId });

    // Also include mesas created during tests (numero >= 90)
    const e2eMesas = await prisma.mesa.findMany({ where: { numero: { gte: 90 } }, select: { id: true } });
    if (e2eMesas.length > 0) {
      pedidoFilter.OR.push({ mesaId: { in: e2eMesas.map(m => m.id) } });
    }

    let pedidoIds = [];
    if (pedidoFilter.OR.length > 0) {
      const pedidos = await prisma.pedido.findMany({ where: pedidoFilter, select: { id: true } });
      pedidoIds = pedidos.map(p => p.id);
    }

    // Delete in FK dependency order
    if (pedidoIds.length > 0) {
      const itemIds = (await prisma.pedidoItem.findMany({
        where: { pedidoId: { in: pedidoIds } }, select: { id: true }
      })).map(i => i.id);

      if (itemIds.length > 0) {
        await prisma.pedidoItemModificador.deleteMany({ where: { pedidoItemId: { in: itemIds } } });
      }

      await prisma.printJob.deleteMany({ where: { pedidoId: { in: pedidoIds } } });
      await prisma.pago.deleteMany({ where: { pedidoId: { in: pedidoIds } } });
      await prisma.pedidoItem.deleteMany({ where: { pedidoId: { in: pedidoIds } } });
      await prisma.movimientoStock.deleteMany({ where: { pedidoId: { in: pedidoIds } } });
      await prisma.pedido.deleteMany({ where: { id: { in: pedidoIds } } });
    }

    // Delete stock movements by E2E ingredients
    await prisma.movimientoStock.deleteMany({
      where: { ingrediente: { nombre: { startsWith: 'E2E' } } }
    });

    // Delete reservas on E2E mesas OR with E2E client names
    await prisma.reserva.deleteMany({
      where: {
        OR: [
          ...(e2eMesas.length > 0 ? [{ mesaId: { in: e2eMesas.map(m => m.id) } }] : []),
          { clienteNombre: { startsWith: 'Cliente E2E' } },
          { clienteNombre: { startsWith: 'E2E' } }
        ]
      }
    });

    // Delete fichajes and liquidaciones by E2E empleados
    const e2eEmpleados = await prisma.empleado.findMany({ where: { dni: { startsWith: '999' } }, select: { id: true } });
    if (e2eEmpleados.length > 0) {
      const empIds = e2eEmpleados.map(e => e.id);
      await prisma.fichaje.deleteMany({ where: { empleadoId: { in: empIds } } });
      await prisma.liquidacion.deleteMany({ where: { empleadoId: { in: empIds } } });
    }

    // Delete cierres by E2E user
    if (testData.userId) {
      await prisma.cierreCaja.deleteMany({ where: { usuarioId: testData.userId } });
    }

    // Delete product relations
    await prisma.productoModificador.deleteMany({ where: { producto: { nombre: { startsWith: 'E2E' } } } });
    await prisma.productoIngrediente.deleteMany({ where: { producto: { nombre: { startsWith: 'E2E' } } } });

    // Delete entities
    await prisma.producto.deleteMany({ where: { nombre: { startsWith: 'E2E' } } });
    await prisma.categoria.deleteMany({ where: { nombre: { startsWith: 'E2E' } } });
    await prisma.modificador.deleteMany({ where: { nombre: { startsWith: 'E2E' } } });
    await prisma.mesa.deleteMany({ where: { numero: { gte: 90 } } });
    await prisma.empleado.deleteMany({ where: { dni: { startsWith: '999' } } });
    await prisma.ingrediente.deleteMany({ where: { nombre: { startsWith: 'E2E' } } });

    // Delete user last
    if (testData.userId) {
      await prisma.refreshToken.deleteMany({ where: { usuarioId: testData.userId } });
      await prisma.emailVerificacion.deleteMany({ where: { usuarioId: testData.userId } });
      await prisma.usuario.deleteMany({ where: { email: 'e2e-admin@test.com' } });
    }

    console.log('[E2E Teardown] Cleanup complete');
  } catch (error) {
    console.error('[E2E Teardown] Error during cleanup:', error.message);
  }

  // Remove test data file
  try {
    fs.unlinkSync(dataPath);
    console.log('[E2E Teardown] Removed test data file');
  } catch (e) {
    // Ignore if already removed
  }

  await prisma.$disconnect();
  console.log('[E2E Teardown] Complete!\n');
}

module.exports = globalTeardown;
