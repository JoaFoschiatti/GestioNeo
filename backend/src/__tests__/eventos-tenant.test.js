const request = require('supertest');
const app = require('../app');
const eventBus = require('../services/event-bus');
const {
  prisma,
  uniqueId,
  createTenant,
  createUsuario,
  signTokenForUser,
  authHeader,
  cleanupTenantData
} = require('./helpers/test-helpers');

describe('Eventos tenant-scoped', () => {
  let tenant;
  let token;

  beforeAll(async () => {
    tenant = await createTenant();
    const admin = await createUsuario(tenant.id, {
      email: `${uniqueId('admin')}@example.com`,
      rol: 'ADMIN'
    });
    token = signTokenForUser(admin);
  });

  afterAll(async () => {
    await cleanupTenantData(tenant.id);
    await prisma.$disconnect();
  });

  it('pedido.updated y mesa.updated incluyen tenantId', async () => {
    const captured = [];
    const unsubscribe = eventBus.subscribe((event) => captured.push(event));

    try {
      const mesa = await prisma.mesa.create({
        data: { tenantId: tenant.id, numero: 30, capacidad: 4, estado: 'LIBRE', activa: true }
      });
      const categoria = await prisma.categoria.create({
        data: { tenantId: tenant.id, nombre: `Cat-${uniqueId('cat')}`, orden: 1, activa: true }
      });
      const producto = await prisma.producto.create({
        data: {
          tenantId: tenant.id,
          nombre: `Prod-${uniqueId('prod')}`,
          precio: 10,
          categoriaId: categoria.id,
          disponible: true
        }
      });

      const response = await request(app)
        .post('/api/pedidos')
        .set('Authorization', authHeader(token))
        .send({
          tipo: 'MESA',
          mesaId: mesa.id,
          items: [{ productoId: producto.id, cantidad: 1 }]
        })
        .expect(201);

      const pedidoId = response.body.id;

      await new Promise(resolve => setImmediate(resolve));

      const pedidoUpdated = captured.find(e => e.type === 'pedido.updated' && e.payload?.id === pedidoId);
      expect(pedidoUpdated).toBeDefined();
      expect(pedidoUpdated.payload.tenantId).toBe(tenant.id);

      const mesaUpdated = captured.find(e => e.type === 'mesa.updated' && e.payload?.mesaId === mesa.id);
      expect(mesaUpdated).toBeDefined();
      expect(mesaUpdated.payload.tenantId).toBe(tenant.id);
    } finally {
      unsubscribe();
    }
  });

  it('reserva.created incluye tenantId', async () => {
    const captured = [];
    const unsubscribe = eventBus.subscribe((event) => captured.push(event));

    try {
      const mesa = await prisma.mesa.create({
        data: { tenantId: tenant.id, numero: 31, capacidad: 4, estado: 'LIBRE', activa: true }
      });

      const response = await request(app)
        .post('/api/reservas')
        .set('Authorization', authHeader(token))
        .send({
          mesaId: mesa.id,
          clienteNombre: 'Cliente Test',
          fechaHora: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          cantidadPersonas: 2
        })
        .expect(201);

      const reservaId = response.body.id;

      await new Promise(resolve => setImmediate(resolve));

      const reservaCreated = captured.find(e => e.type === 'reserva.created' && e.payload?.id === reservaId);
      expect(reservaCreated).toBeDefined();
      expect(reservaCreated.payload.tenantId).toBe(tenant.id);
    } finally {
      unsubscribe();
    }
  });
});

