const { procesarReservas } = require('../jobs/reservas.job');
const eventBus = require('../services/event-bus');
const {
  prisma,
  createTenant,
  cleanupTenantData,
  uniqueId
} = require('./helpers/test-helpers');

describe('reservas.job', () => {
  let tenant;
  let mesa;
  let mesaVencida;

  beforeAll(async () => {
    tenant = await createTenant();

    mesa = await prisma.mesa.create({
      data: {
        tenantId: tenant.id,
        numero: 1,
        capacidad: 4,
        estado: 'LIBRE'
      }
    });

    mesaVencida = await prisma.mesa.create({
      data: {
        tenantId: tenant.id,
        numero: 2,
        capacidad: 4,
        estado: 'RESERVADA'
      }
    });
  });

  afterAll(async () => {
    if (tenant?.id) {
      await cleanupTenantData(tenant.id);
    }
    await prisma.$disconnect();
  });

  it('marca mesas reservadas y reservas vencidas', async () => {
    const ahora = Date.now();

    const reservaProxima = await prisma.reserva.create({
      data: {
        tenantId: tenant.id,
        mesaId: mesa.id,
        clienteNombre: `Cliente ${uniqueId('cliente')}`,
        clienteTelefono: '123',
        cantidadPersonas: 2,
        estado: 'CONFIRMADA',
        fechaHora: new Date(ahora + 10 * 60 * 1000)
      }
    });

    const reservaVencida = await prisma.reserva.create({
      data: {
        tenantId: tenant.id,
        mesaId: mesaVencida.id,
        clienteNombre: `Cliente ${uniqueId('cliente')}`,
        clienteTelefono: '321',
        cantidadPersonas: 2,
        estado: 'CONFIRMADA',
        fechaHora: new Date(ahora - 40 * 60 * 1000)
      }
    });

    const publishSpy = jest.spyOn(eventBus, 'publish');

    await procesarReservas();

    const mesaActualizada = await prisma.mesa.findUnique({ where: { id: mesa.id } });
    const mesaLiberada = await prisma.mesa.findUnique({ where: { id: mesaVencida.id } });
    const reservaActualizada = await prisma.reserva.findUnique({ where: { id: reservaVencida.id } });

    expect(mesaActualizada.estado).toBe('RESERVADA');
    expect(mesaLiberada.estado).toBe('LIBRE');
    expect(reservaActualizada.estado).toBe('NO_LLEGO');

    expect(
      publishSpy.mock.calls.some(([type, payload]) =>
        type === 'mesa.updated' && payload.mesaId === mesa.id
      )
    ).toBe(true);

    expect(
      publishSpy.mock.calls.some(([type, payload]) =>
        type === 'reserva.updated' && payload.id === reservaVencida.id
      )
    ).toBe(true);

    publishSpy.mockRestore();
  });
});
