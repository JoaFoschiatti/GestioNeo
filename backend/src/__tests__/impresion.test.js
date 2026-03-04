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

describe('Impresion Endpoints', () => {
  let token;
  let pedido;
  let producto;

  beforeAll(async () => {
    process.env.BRIDGE_TOKEN = 'test-bridge-token';

    await cleanupTestData();
    await ensureActiveSuscripcion();
    const admin = await createUsuario({
      email: `${uniqueId('admin')}@example.com`,
      rol: 'ADMIN'
    });
    token = signTokenForUser(admin);

    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat')}`, orden: 1, activa: true }
    });
    producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('prod')}`,
        precio: 10,
        categoriaId: categoria.id,
        disponible: true
      }
    });
    pedido = await prisma.pedido.create({
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
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it('POST /api/impresion/comanda/:pedidoId encola jobs', async () => {
    const response = await request(app)
      .post(`/api/impresion/comanda/${pedido.id}`)
      .set('Authorization', authHeader(token))
      .send({})
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.total).toBe(3);
    expect(response.body.batchId).toBeDefined();

    const jobs = await prisma.printJob.findMany({
      where: { pedidoId: pedido.id }
    });
    expect(jobs.length).toBe(3);
  });

  it('GET /api/impresion/comanda/:pedidoId/preview devuelve texto', async () => {
    const response = await request(app)
      .get(`/api/impresion/comanda/${pedido.id}/preview?tipo=CAJA`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(response.headers['content-type']).toMatch(/text\/plain/);
    expect(response.text).toContain(`Pedido: #${pedido.id}`);
    expect(response.text).toContain(producto.nombre);
  });

  it('Bridge: claim/ack/fail opera sobre jobs', async () => {
    const claimed = await request(app)
      .post('/api/impresion/jobs/claim')
      .set('x-bridge-token', process.env.BRIDGE_TOKEN)
      .send({ bridgeId: 'bridge-test', limit: 3 })
      .expect(200);

    expect(claimed.body.jobs.length).toBeGreaterThan(0);
    expect(claimed.body.jobs.length).toBeLessThanOrEqual(3);

    const [jobA, jobB] = claimed.body.jobs;
    expect(jobA).toBeDefined();
    expect(jobB).toBeDefined();

    await request(app)
      .post(`/api/impresion/jobs/${jobA.id}/ack`)
      .set('x-bridge-token', process.env.BRIDGE_TOKEN)
      .send({ bridgeId: 'bridge-test' })
      .expect(200);

    const jobAUpdated = await prisma.printJob.findUnique({ where: { id: jobA.id } });
    expect(jobAUpdated.status).toBe('OK');

    await request(app)
      .post(`/api/impresion/jobs/${jobB.id}/fail`)
      .set('x-bridge-token', process.env.BRIDGE_TOKEN)
      .send({ bridgeId: 'bridge-test', error: 'Printer error' })
      .expect(200);

    const jobBUpdated = await prisma.printJob.findUnique({ where: { id: jobB.id } });
    expect(['PENDIENTE', 'ERROR']).toContain(jobBUpdated.status);
  });
});

