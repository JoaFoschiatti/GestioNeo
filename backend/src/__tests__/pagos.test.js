const request = require('supertest');
const app = require('../app');
const {
  prisma,
  uniqueId,
  createTenant,
  createUsuario,
  signTokenForUser,
  authHeader,
  cleanupTenantData
} = require('./helpers/test-helpers');

describe('Pagos Endpoints', () => {
  let tenant;
  let token;
  let tenantSecundario;

  beforeAll(async () => {
    tenant = await createTenant();
    const admin = await createUsuario(tenant.id, {
      email: `${uniqueId('admin')}@example.com`,
      rol: 'ADMIN'
    });
    token = signTokenForUser(admin);

    tenantSecundario = await createTenant();
  });

  afterAll(async () => {
    await cleanupTenantData(tenant.id);
    await cleanupTenantData(tenantSecundario.id);
    await prisma.$disconnect();
  });

  it('POST /api/pagos permite pagos parciales y completa el pedido (libera mesa)', async () => {
    const mesa = await prisma.mesa.create({
      data: {
        tenantId: tenant.id,
        numero: 1,
        capacidad: 4,
        estado: 'OCUPADA',
        activa: true
      }
    });

    const pedido = await prisma.pedido.create({
      data: {
        tenantId: tenant.id,
        tipo: 'MESA',
        mesaId: mesa.id,
        subtotal: 100,
        total: 100
      }
    });

    const pago1 = await request(app)
      .post('/api/pagos')
      .set('Authorization', authHeader(token))
      .send({ pedidoId: pedido.id, monto: 40, metodo: 'EFECTIVO' })
      .expect(201);

    expect(pago1.body.pago.id).toBeDefined();
    expect(Number(pago1.body.totalPagado)).toBe(40);
    expect(Number(pago1.body.pendiente)).toBe(60);
    expect(pago1.body.pedido.estado).toBe('PENDIENTE');

    const pago2 = await request(app)
      .post('/api/pagos')
      .set('Authorization', authHeader(token))
      .send({ pedidoId: pedido.id, monto: 60, metodo: 'TARJETA' })
      .expect(201);

    expect(Number(pago2.body.totalPagado)).toBe(100);
    expect(Number(pago2.body.pendiente)).toBe(0);
    expect(pago2.body.pedido.estado).toBe('COBRADO');

    const mesaActualizada = await prisma.mesa.findUnique({ where: { id: mesa.id } });
    expect(mesaActualizada.estado).toBe('LIBRE');
  });

  it('POST /api/pagos rechaza monto mayor al pendiente', async () => {
    const pedido = await prisma.pedido.create({
      data: {
        tenantId: tenant.id,
        tipo: 'MOSTRADOR',
        subtotal: 10,
        total: 10
      }
    });

    await request(app)
      .post('/api/pagos')
      .set('Authorization', authHeader(token))
      .send({ pedidoId: pedido.id, monto: 5, metodo: 'EFECTIVO' })
      .expect(201);

    const response = await request(app)
      .post('/api/pagos')
      .set('Authorization', authHeader(token))
      .send({ pedidoId: pedido.id, monto: 10, metodo: 'EFECTIVO' })
      .expect(400);

    expect(response.body.error.message).toMatch(/El monto excede el pendiente/);
  });

  it('POST /api/pagos rechaza pagar pedido cancelado', async () => {
    const pedido = await prisma.pedido.create({
      data: {
        tenantId: tenant.id,
        tipo: 'MOSTRADOR',
        subtotal: 10,
        total: 10,
        estado: 'CANCELADO'
      }
    });

    const response = await request(app)
      .post('/api/pagos')
      .set('Authorization', authHeader(token))
      .send({ pedidoId: pedido.id, monto: 10, metodo: 'EFECTIVO' })
      .expect(400);

    expect(response.body.error.message).toBe('No se puede pagar un pedido cancelado');
  });

  it('GET /api/pagos/pedido/:pedidoId lista pagos y calcula totales', async () => {
    const pedido = await prisma.pedido.create({
      data: {
        tenantId: tenant.id,
        tipo: 'MOSTRADOR',
        subtotal: 50,
        total: 50
      }
    });

    await request(app)
      .post('/api/pagos')
      .set('Authorization', authHeader(token))
      .send({ pedidoId: pedido.id, monto: 20, metodo: 'EFECTIVO' })
      .expect(201);

    const response = await request(app)
      .get(`/api/pagos/pedido/${pedido.id}`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(Number(response.body.totalPedido)).toBe(50);
    expect(Number(response.body.totalPagado)).toBe(20);
    expect(Number(response.body.pendiente)).toBe(30);
    expect(Array.isArray(response.body.pagos)).toBe(true);
  });

  it('Aislamiento multi-tenant: no permite pagar pedido de otro tenant', async () => {
    const pedidoOtroTenant = await prisma.pedido.create({
      data: {
        tenantId: tenantSecundario.id,
        tipo: 'MOSTRADOR',
        subtotal: 10,
        total: 10
      }
    });

    const response = await request(app)
      .post('/api/pagos')
      .set('Authorization', authHeader(token))
      .send({ pedidoId: pedidoOtroTenant.id, monto: 10, metodo: 'EFECTIVO' })
      .expect(404);

    expect(response.body.error.message).toBe('Pedido no encontrado');
  });

  it('POST /api/pagos/mercadopago/preferencia crea preferencia mock', async () => {
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
    const pedido = await prisma.pedido.create({
      data: {
        tenantId: tenant.id,
        tipo: 'MOSTRADOR',
        subtotal: 10,
        total: 10
      }
    });
    await prisma.pedidoItem.create({
      data: {
        tenantId: tenant.id,
        pedidoId: pedido.id,
        productoId: producto.id,
        cantidad: 1,
        precioUnitario: 10,
        subtotal: 10
      }
    });

    const response = await request(app)
      .post('/api/pagos/mercadopago/preferencia')
      .set('Authorization', authHeader(token))
      .send({ pedidoId: pedido.id })
      .expect(200);

    expect(response.body.preferencia).toBeDefined();
    expect(response.body.preferencia.id).toMatch(`PREF_${pedido.id}_`);
    expect(response.body.preferencia.init_point).toContain('mercadopago.com.ar');
  });
});
