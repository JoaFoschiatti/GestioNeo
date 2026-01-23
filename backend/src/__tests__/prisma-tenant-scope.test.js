const { getTenantPrisma, prisma } = require('../db/prisma');
const { createTenant, cleanupTenantData, uniqueId } = require('./helpers/test-helpers');

describe('Prisma tenant scoping', () => {
  let tenantA;
  let tenantB;
  let mesaB;

  beforeAll(async () => {
    tenantA = await createTenant();
    tenantB = await createTenant();

    mesaB = await prisma.mesa.create({
      data: {
        tenantId: tenantB.id,
        numero: 1,
        zona: `Zona-${uniqueId('zona')}`,
        capacidad: 4,
        estado: 'LIBRE',
        activa: true
      }
    });
  });

  afterAll(async () => {
    await cleanupTenantData(tenantA.id);
    await cleanupTenantData(tenantB.id);
    await prisma.$disconnect();
  });

  it('update sobre registro de otro tenant lanza 404', async () => {
    const tenantPrisma = getTenantPrisma(tenantA.id);

    await expect(
      tenantPrisma.mesa.update({
        where: { id: mesaB.id },
        data: { zona: 'Nueva' }
      })
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('upsert sobre registro de otro tenant lanza 404', async () => {
    const tenantPrisma = getTenantPrisma(tenantA.id);

    await expect(
      tenantPrisma.mesa.upsert({
        where: { id: mesaB.id },
        update: { zona: 'Nueva' },
        create: {
          numero: 999,
          zona: 'Should not create',
          capacidad: 4,
          estado: 'LIBRE',
          activa: true
        }
      })
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });
});

