const path = require('path');
const fs = require('fs');

// Use Prisma Client from backend (already generated with schema)
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
  const { tenantId } = testData;

  if (!tenantId) {
    console.log('[E2E Teardown] No tenant ID found, skipping cleanup');
    return;
  }

  try {
    // Cleanup in reverse order of dependencies
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

    console.log(`[E2E Teardown] Cleaned up tenant ID: ${tenantId}`);
  } catch (error) {
    console.error('[E2E Teardown] Error during cleanup:', error.message);
  }

  // Remove test data file
  fs.unlinkSync(dataPath);
  console.log('[E2E Teardown] Removed test data file');

  await prisma.$disconnect();
  console.log('[E2E Teardown] Complete!\n');
}

module.exports = globalTeardown;
