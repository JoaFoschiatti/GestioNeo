const request = require('supertest');

const mockCreatePreference = jest.fn();
const mockSearchPaymentByReference = jest.fn();
const mockSaveTransaction = jest.fn();

jest.mock('../services/mercadopago.service', () => {
  const actual = jest.requireActual('../services/mercadopago.service');
  return {
    ...actual,
    createPreference: (...args) => mockCreatePreference(...args),
    searchPaymentByReference: (...args) => mockSearchPaymentByReference(...args),
    saveTransaction: (...args) => mockSaveTransaction(...args)
  };
});

const app = require('../app');
const eventBus = require('../services/event-bus');
const {
  prisma,
  uniqueId,
  cleanupTestData,
  ensureActiveSuscripcion
} = require('./helpers/test-helpers');

describe('Publico MercadoPago', () => {
  beforeAll(async () => {
    await cleanupTestData();
    await ensureActiveSuscripcion();

    await prisma.mercadoPagoConfig.upsert({
      where: { id: 1 },
      update: {
        accessToken: 'dummy-token',
        isActive: true,
        isOAuth: false
      },
      create: {
        accessToken: 'dummy-token',
        isActive: true,
        isOAuth: false
      }
    });

    await prisma.configuracion.create({
      data: {
        clave: 'mercadopago_enabled',
        valor: 'true'
      }
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(() => {
    mockCreatePreference.mockReset();
    mockSearchPaymentByReference.mockReset();
    mockSaveTransaction.mockReset();
  });

  it('POST /api/publico/pedido con MERCADOPAGO crea preferencia y pago pendiente', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat')}`, orden: 1, activa: true }
    });
    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('prod')}`,
        precio: 123,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    mockCreatePreference.mockResolvedValue({
      id: 'PREF_TEST',
      init_point: 'https://mercadopago.test/init'
    });

    const response = await request(app)
      .post('/api/publico/pedido')
      .send({
        items: [{ productoId: producto.id, cantidad: 1 }],
        clienteNombre: 'Cliente Test',
        clienteTelefono: '3410000000',
        tipoEntrega: 'RETIRO',
        metodoPago: 'MERCADOPAGO'
      })
      .expect(201);

    expect(response.body.initPoint).toBe('https://mercadopago.test/init');
    expect(response.body.pedido.origen).toBe('MENU_PUBLICO');

    const pedidoId = response.body.pedido.id;

    const pagos = await prisma.pago.findMany({ where: { pedidoId } });
    expect(pagos).toHaveLength(1);
    expect(pagos[0].metodo).toBe('MERCADOPAGO');
    expect(pagos[0].estado).toBe('PENDIENTE');
    expect(pagos[0].mpPreferenceId).toBe('PREF_TEST');
  });

  it('POST /api/publico/pedido rechaza MP si está deshabilitado', async () => {
    await prisma.configuracion.update({
      where: { clave: 'mercadopago_enabled' },
      data: { valor: 'false' }
    });

    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat-off')}`, orden: 1, activa: true }
    });
    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('prod-off')}`,
        precio: 100,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    const response = await request(app)
      .post('/api/publico/pedido')
      .send({
        items: [{ productoId: producto.id, cantidad: 1 }],
        clienteNombre: 'Cliente Test',
        clienteTelefono: '3410000000',
        tipoEntrega: 'RETIRO',
        metodoPago: 'MERCADOPAGO'
      })
      .expect(400);

    expect(response.body.error.message).toBe('MercadoPago no está disponible en este momento');

    await prisma.configuracion.update({
      where: { clave: 'mercadopago_enabled' },
      data: { valor: 'true' }
    });
  });

  it('POST /api/publico/pedido/:id/pagar crea un nuevo pago pendiente y devuelve initPoint', async () => {
    // Create pedido via public API to get a valid publicAccessToken
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('pagar')}`, orden: 1, activa: true }
    });
    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('pagar')}`,
        precio: 50,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    // First call creates the pedido with EFECTIVO to get a publicAccessToken
    const createRes = await request(app)
      .post('/api/publico/pedido')
      .send({
        items: [{ productoId: producto.id, cantidad: 1 }],
        clienteNombre: 'Cliente Pagar',
        clienteTelefono: '3410000000',
        tipoEntrega: 'RETIRO',
        metodoPago: 'EFECTIVO'
      })
      .expect(201);

    const pedidoId = createRes.body.pedido.id;
    const accessToken = createRes.body.publicAccessToken;

    // Update pedido to PENDIENTE so we can pay again
    await prisma.pedido.update({
      where: { id: pedidoId },
      data: { estadoPago: 'PENDIENTE' }
    });
    // Remove the existing efectivo pago
    await prisma.pago.deleteMany({ where: { pedidoId } });

    mockCreatePreference.mockResolvedValue({
      id: 'PREF_PAY',
      init_point: 'https://mercadopago.test/pay',
      sandbox_init_point: 'https://sandbox.mercadopago.test/pay'
    });

    const response = await request(app)
      .post(`/api/publico/pedido/${pedidoId}/pagar?token=${encodeURIComponent(accessToken)}`)
      .send({})
      .expect(200);

    expect(response.body.preferenceId).toBe('PREF_PAY');
    expect(response.body.initPoint).toBe('https://mercadopago.test/pay');
    expect(response.body.sandboxInitPoint).toBe('https://sandbox.mercadopago.test/pay');

    const pagos = await prisma.pago.findMany({ where: { pedidoId } });
    expect(pagos).toHaveLength(1);
    expect(pagos[0].mpPreferenceId).toBe('PREF_PAY');
    expect(pagos[0].estado).toBe('PENDIENTE');
  });

  it('GET /api/publico/pedido/:id actualiza estadoPago si searchPaymentByReference devuelve aprobado', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat-status')}`, orden: 1, activa: true }
    });
    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('prod-status')}`,
        precio: 50,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    // Create pedido via public API to get a valid publicAccessToken
    mockCreatePreference.mockResolvedValue({
      id: 'PREF_STATUS',
      init_point: 'https://mercadopago.test/status'
    });

    const createRes = await request(app)
      .post('/api/publico/pedido')
      .send({
        items: [{ productoId: producto.id, cantidad: 1 }],
        clienteNombre: 'Cliente Status',
        clienteTelefono: '3410000000',
        tipoEntrega: 'RETIRO',
        metodoPago: 'MERCADOPAGO'
      })
      .expect(201);

    const pedidoId = createRes.body.pedido.id;
    const accessToken = createRes.body.publicAccessToken;

    // Get the pago created by the public order
    const pagos = await prisma.pago.findMany({ where: { pedidoId } });
    const pago = pagos[0];

    mockSearchPaymentByReference.mockResolvedValue({
      id: 555,
      status: 'approved'
    });
    mockSaveTransaction.mockResolvedValue({});

    const captured = [];
    const unsubscribe = eventBus.subscribe((event) => captured.push(event));

    try {
      const response = await request(app)
        .get(`/api/publico/pedido/${pedidoId}?token=${encodeURIComponent(accessToken)}`)
        .expect(200);

      expect(response.body.estadoPago).toBe('APROBADO');
      const pagoEnRespuesta = response.body.pagos.find(p => p.id === pago.id);
      expect(pagoEnRespuesta.estado).toBe('APROBADO');
      expect(pagoEnRespuesta.mpPaymentId).toBe('555');

      const pagoActualizado = await prisma.pago.findUnique({ where: { id: pago.id } });
      expect(pagoActualizado.estado).toBe('APROBADO');
      expect(pagoActualizado.mpPaymentId).toBe('555');

      const pedidoActualizado = await prisma.pedido.findUnique({ where: { id: pedidoId } });
      expect(pedidoActualizado.estadoPago).toBe('APROBADO');

      const evento = captured.find(e => e.type === 'pedido.updated' && e.payload?.id === pedidoId);
      expect(evento).toBeDefined();
      expect(evento.payload).toEqual(expect.objectContaining({
        id: pedidoId,
        estadoPago: 'APROBADO'
      }));
    } finally {
      unsubscribe();
    }
  });
});
