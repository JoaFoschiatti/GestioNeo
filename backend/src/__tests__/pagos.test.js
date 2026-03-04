const request = require('supertest');
const app = require('../app');
const {
  prisma,
  uniqueId,
  createUsuario,
  signTokenForUser,
  authHeader,
  cleanupTestData,
  ensureActiveSuscripcion
} = require('./helpers/test-helpers');
const pagosService = require('../services/pagos.service');

describe('Pagos Endpoints', () => {
  let token;

  beforeAll(async () => {
    await cleanupTestData();
    await ensureActiveSuscripcion();
    const admin = await createUsuario({
      email: `${uniqueId('admin')}@example.com`,
      rol: 'ADMIN'
    });
    token = signTokenForUser(admin);
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it('POST /api/pagos permite pagos parciales y completa el pedido (libera mesa)', async () => {
    const mesa = await prisma.mesa.create({
      data: {
        numero: 1,
        capacidad: 4,
        estado: 'OCUPADA',
        activa: true
      }
    });

    const pedido = await prisma.pedido.create({
      data: {
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

  it('POST /api/pagos/mercadopago/preferencia crea preferencia mock', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat')}`, orden: 1, activa: true }
    });
    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('prod')}`,
        precio: 10,
        categoriaId: categoria.id,
        disponible: true
      }
    });
    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: 10,
        total: 10
      }
    });
    await prisma.pedidoItem.create({
      data: {
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

  // A1: Propinas
  it('POST /api/pagos acepta propina y la guarda en el pago', async () => {
    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: 100,
        total: 100
      }
    });

    const response = await request(app)
      .post('/api/pagos')
      .set('Authorization', authHeader(token))
      .send({ pedidoId: pedido.id, monto: 100, metodo: 'EFECTIVO', propina: 50 })
      .expect(201);

    expect(response.body.pago.id).toBeDefined();

    const pagoDb = await prisma.pago.findUnique({ where: { id: response.body.pago.id } });
    expect(Number(pagoDb.propina)).toBe(50);
  });

  // A4: completarPagoPedido
  it('completarPagoPedido marca COBRADO y libera mesa cuando pago >= total', async () => {
    const mesa = await prisma.mesa.create({
      data: {
        numero: Math.floor(Math.random() * 900000) + 100000,
        capacidad: 4,
        estado: 'OCUPADA',
        activa: true
      }
    });

    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MESA',
        mesaId: mesa.id,
        subtotal: 100,
        total: 100
      }
    });

    await prisma.pago.create({
      data: {
        pedidoId: pedido.id,
        monto: 100,
        metodo: 'MERCADOPAGO',
        estado: 'APROBADO'
      }
    });

    const result = await pagosService.completarPagoPedido(prisma, pedido.id);
    expect(result.pedidoActualizado.estado).toBe('COBRADO');
    expect(result.mesaLiberada).toBe(true);

    const mesaDb = await prisma.mesa.findUnique({ where: { id: mesa.id } });
    expect(mesaDb.estado).toBe('LIBRE');
  });

  it('completarPagoPedido no cambia estado si pago insuficiente', async () => {
    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: 100,
        total: 100
      }
    });

    await prisma.pago.create({
      data: {
        pedidoId: pedido.id,
        monto: 50,
        metodo: 'MERCADOPAGO',
        estado: 'APROBADO'
      }
    });

    const result = await pagosService.completarPagoPedido(prisma, pedido.id);
    expect(result.pedidoActualizado.estado).toBe('PENDIENTE');
    expect(result.mesaLiberada).toBe(false);
  });
});
