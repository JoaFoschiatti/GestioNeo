const request = require('supertest');

const mockGetPayment = jest.fn();
const mockSaveTransaction = jest.fn();

jest.mock('../services/mercadopago.service', () => {
  const actual = jest.requireActual('../services/mercadopago.service');
  return {
    ...actual,
    getPayment: (...args) => mockGetPayment(...args),
    saveTransaction: (...args) => mockSaveTransaction(...args)
  };
});

jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest.fn().mockImplementation(() => ({})),
  Payment: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    search: jest.fn()
  })),
  Preference: jest.fn().mockImplementation(() => ({
    create: jest.fn()
  }))
}));

const app = require('../app');
const pagosController = require('../controllers/pagos.controller');
const {
  prisma,
  uniqueId,
  cleanupTestData,
  ensureActiveSuscripcion
} = require('./helpers/test-helpers');

describe('MercadoPago Webhook', () => {
  let originalVerify;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    // Mock webhook signature verification for tests
    originalVerify = pagosController._verifyWebhookSignature;
    pagosController._verifyWebhookSignature = () => true;
    await cleanupTestData();
    await ensureActiveSuscripcion();
  });

  afterAll(async () => {
    pagosController._verifyWebhookSignature = originalVerify;
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(() => {
    mockGetPayment.mockReset();
    mockSaveTransaction.mockReset();
  });

  it('actualiza el pago existente por mpPaymentId (sin duplicar)', async () => {
    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: 100,
        total: 100
      }
    });

    const pagoExistente = await prisma.pago.create({
      data: {
        pedidoId: pedido.id,
        monto: 100,
        metodo: 'MERCADOPAGO',
        estado: 'PENDIENTE',
        mpPaymentId: '123',
        idempotencyKey: `mp-${pedido.id}-${uniqueId('idem')}`
      }
    });

    mockGetPayment.mockResolvedValue({
      id: 123,
      status: 'approved',
      transaction_amount: '100.00',
      external_reference: `${pedido.id}`,
      preference_id: 'PREF-123'
    });
    mockSaveTransaction.mockResolvedValue({});

    await request(app)
      .post('/api/pagos/webhook/mercadopago')
      .send({ type: 'payment', data: { id: '123' } })
      .expect(200);

    const pagos = await prisma.pago.findMany({
      where: { pedidoId: pedido.id },
      orderBy: { id: 'asc' }
    });

    expect(pagos).toHaveLength(1);
    expect(pagos[0].id).toBe(pagoExistente.id);
    expect(pagos[0].estado).toBe('APROBADO');
    expect(pagos[0].mpPaymentId).toBe('123');
    expect(pagos[0].referencia).toBe('MP-123');

    const pedidoActual = await prisma.pedido.findUnique({ where: { id: pedido.id } });
    expect(pedidoActual.estadoPago).toBe('APROBADO');

    await request(app)
      .post('/api/pagos/webhook/mercadopago')
      .send({ type: 'payment', data: { id: '123' } })
      .expect(200);

    const pagosDespues = await prisma.pago.findMany({
      where: { pedidoId: pedido.id }
    });
    expect(pagosDespues).toHaveLength(1);
  });

  it('matchea el pago pendiente por mpPreferenceId (sin crear un duplicado)', async () => {
    const tokenAnterior = process.env.MERCADOPAGO_ACCESS_TOKEN;
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'test-token';

    try {
      const pedido = await prisma.pedido.create({
        data: {
          tipo: 'MOSTRADOR',
          subtotal: 50,
          total: 50
        }
      });

      const pagoPendiente = await prisma.pago.create({
        data: {
          pedidoId: pedido.id,
          monto: 50,
          metodo: 'MERCADOPAGO',
          estado: 'PENDIENTE',
          mpPreferenceId: 'PREF-XYZ',
          idempotencyKey: `mp-${pedido.id}-${uniqueId('idem')}`
        }
      });

      mockGetPayment.mockImplementation(() => {
        throw new Error('getPayment no debería llamarse en fallback global');
      });
      mockSaveTransaction.mockResolvedValue({});

      const mercadopago = require('mercadopago');
      mercadopago.Payment.mockImplementation(() => ({
        get: jest.fn().mockResolvedValue({
          id: 999,
          status: 'approved',
          transaction_amount: '50.00',
          external_reference: `${pedido.id}`,
          preference_id: 'PREF-XYZ'
        })
      }));

      await request(app)
        .post('/api/pagos/webhook/mercadopago')
        .send({ type: 'payment', data: { id: '999' } })
        .expect(200);

      const pagos = await prisma.pago.findMany({
        where: { pedidoId: pedido.id },
        orderBy: { id: 'asc' }
      });

      expect(pagos).toHaveLength(1);
      expect(pagos[0].id).toBe(pagoPendiente.id);
      expect(pagos[0].estado).toBe('APROBADO');
      expect(pagos[0].mpPaymentId).toBe('999');
      expect(pagos[0].referencia).toBe('MP-999');
      expect(pagos[0].mpPreferenceId).toBe('PREF-XYZ');

      const pedidoActual = await prisma.pedido.findUnique({ where: { id: pedido.id } });
      expect(pedidoActual.estadoPago).toBe('APROBADO');
    } finally {
      if (typeof tokenAnterior === 'undefined') {
        delete process.env.MERCADOPAGO_ACCESS_TOKEN;
      } else {
        process.env.MERCADOPAGO_ACCESS_TOKEN = tokenAnterior;
      }
    }
  });
});
