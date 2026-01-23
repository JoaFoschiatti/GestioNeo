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
  createTenant,
  cleanupTenantData
} = require('./helpers/test-helpers');

describe('Publico MercadoPago', () => {
  let tenant;

  beforeAll(async () => {
    tenant = await createTenant({ slug: uniqueId('tenant-publico-mp') });

    await prisma.mercadoPagoConfig.create({
      data: {
        tenantId: tenant.id,
        accessToken: 'dummy-token',
        isActive: true,
        isOAuth: false
      }
    });

    await prisma.configuracion.create({
      data: {
        tenantId: tenant.id,
        clave: 'mercadopago_enabled',
        valor: 'true'
      }
    });
  });

  afterAll(async () => {
    await cleanupTenantData(tenant.id);
    await prisma.$disconnect();
  });

  beforeEach(() => {
    mockCreatePreference.mockReset();
    mockSearchPaymentByReference.mockReset();
    mockSaveTransaction.mockReset();
  });

  it('POST /api/publico/:slug/pedido con MERCADOPAGO crea preferencia y pago pendiente', async () => {
    const categoria = await prisma.categoria.create({
      data: { tenantId: tenant.id, nombre: `Cat-${uniqueId('cat')}`, orden: 1, activa: true }
    });
    const producto = await prisma.producto.create({
      data: {
        tenantId: tenant.id,
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
      .post(`/api/publico/${tenant.slug}/pedido`)
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

    const pagos = await prisma.pago.findMany({ where: { tenantId: tenant.id, pedidoId } });
    expect(pagos).toHaveLength(1);
    expect(pagos[0].metodo).toBe('MERCADOPAGO');
    expect(pagos[0].estado).toBe('PENDIENTE');
    expect(pagos[0].mpPreferenceId).toBe('PREF_TEST');
  });

  it('POST /api/publico/:slug/pedido rechaza MP si está deshabilitado', async () => {
    await prisma.configuracion.update({
      where: {
        tenantId_clave: { tenantId: tenant.id, clave: 'mercadopago_enabled' }
      },
      data: { valor: 'false' }
    });

    const categoria = await prisma.categoria.create({
      data: { tenantId: tenant.id, nombre: `Cat-${uniqueId('cat-off')}`, orden: 1, activa: true }
    });
    const producto = await prisma.producto.create({
      data: {
        tenantId: tenant.id,
        nombre: `Prod-${uniqueId('prod-off')}`,
        precio: 100,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    const response = await request(app)
      .post(`/api/publico/${tenant.slug}/pedido`)
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
      where: {
        tenantId_clave: { tenantId: tenant.id, clave: 'mercadopago_enabled' }
      },
      data: { valor: 'true' }
    });
  });

  it('POST /api/publico/:slug/pedido/:id/pagar crea un nuevo pago pendiente y devuelve initPoint', async () => {
    const pedido = await prisma.pedido.create({
      data: {
        tenantId: tenant.id,
        tipo: 'MOSTRADOR',
        subtotal: 50,
        total: 50,
        estadoPago: 'PENDIENTE',
        origen: 'MENU_PUBLICO'
      }
    });

    mockCreatePreference.mockResolvedValue({
      id: 'PREF_PAY',
      init_point: 'https://mercadopago.test/pay',
      sandbox_init_point: 'https://sandbox.mercadopago.test/pay'
    });

    const response = await request(app)
      .post(`/api/publico/${tenant.slug}/pedido/${pedido.id}/pagar`)
      .send({})
      .expect(200);

    expect(response.body.preferenceId).toBe('PREF_PAY');
    expect(response.body.initPoint).toBe('https://mercadopago.test/pay');
    expect(response.body.sandboxInitPoint).toBe('https://sandbox.mercadopago.test/pay');

    const pagos = await prisma.pago.findMany({ where: { tenantId: tenant.id, pedidoId: pedido.id } });
    expect(pagos).toHaveLength(1);
    expect(pagos[0].mpPreferenceId).toBe('PREF_PAY');
    expect(pagos[0].estado).toBe('PENDIENTE');
  });

  it('GET /api/publico/:slug/pedido/:id actualiza estadoPago si searchPaymentByReference devuelve aprobado', async () => {
    const categoria = await prisma.categoria.create({
      data: { tenantId: tenant.id, nombre: `Cat-${uniqueId('cat')}`, orden: 1, activa: true }
    });
    const producto = await prisma.producto.create({
      data: {
        tenantId: tenant.id,
        nombre: `Prod-${uniqueId('prod')}`,
        precio: 50,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    const pedido = await prisma.pedido.create({
      data: {
        tenantId: tenant.id,
        tipo: 'MOSTRADOR',
        subtotal: 50,
        total: 50,
        estadoPago: 'PENDIENTE',
        origen: 'MENU_PUBLICO',
        items: {
          create: [{
            tenantId: tenant.id,
            productoId: producto.id,
            cantidad: 1,
            precioUnitario: 50,
            subtotal: 50
          }]
        }
      }
    });

    const pago = await prisma.pago.create({
      data: {
        tenantId: tenant.id,
        pedidoId: pedido.id,
        monto: 50,
        metodo: 'MERCADOPAGO',
        estado: 'PENDIENTE',
        mpPreferenceId: 'PREF_PENDING',
        idempotencyKey: `mp-${tenant.id}-${pedido.id}-${Date.now()}`
      }
    });

    mockSearchPaymentByReference.mockResolvedValue({
      id: 555,
      status: 'approved'
    });
    mockSaveTransaction.mockResolvedValue({});

    const captured = [];
    const unsubscribe = eventBus.subscribe((event) => captured.push(event));

    try {
      const response = await request(app)
        .get(`/api/publico/${tenant.slug}/pedido/${pedido.id}`)
        .expect(200);

      expect(response.body.estadoPago).toBe('APROBADO');
      const pagoEnRespuesta = response.body.pagos.find(p => p.id === pago.id);
      expect(pagoEnRespuesta.estado).toBe('APROBADO');
      expect(pagoEnRespuesta.mpPaymentId).toBe('555');

      const pagoActualizado = await prisma.pago.findUnique({ where: { id: pago.id } });
      expect(pagoActualizado.estado).toBe('APROBADO');
      expect(pagoActualizado.mpPaymentId).toBe('555');

      const pedidoActualizado = await prisma.pedido.findUnique({ where: { id: pedido.id } });
      expect(pedidoActualizado.estadoPago).toBe('APROBADO');

      const evento = captured.find(e => e.type === 'pedido.updated' && e.payload?.id === pedido.id);
      expect(evento).toBeDefined();
      expect(evento.payload).toEqual(expect.objectContaining({
        tenantId: tenant.id,
        id: pedido.id,
        estadoPago: 'APROBADO'
      }));
    } finally {
      unsubscribe();
    }
  });
});
