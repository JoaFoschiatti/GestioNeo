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

describe('Impresion Endpoints', () => {
  let tenant;
  let token;
  let tenantSecundario;
  let tokenSecundario;
  let pedido;
  let producto;

  beforeAll(async () => {
    process.env.BRIDGE_TOKEN = 'test-bridge-token';

    tenant = await createTenant();
    const admin = await createUsuario(tenant.id, {
      email: `${uniqueId('admin')}@example.com`,
      rol: 'ADMIN'
    });
    token = signTokenForUser(admin);

    tenantSecundario = await createTenant();
    const admin2 = await createUsuario(tenantSecundario.id, {
      email: `${uniqueId('admin2')}@example.com`,
      rol: 'ADMIN'
    });
    tokenSecundario = signTokenForUser(admin2);

    const categoria = await prisma.categoria.create({
      data: { tenantId: tenant.id, nombre: `Cat-${uniqueId('cat')}`, orden: 1, activa: true }
    });
    producto = await prisma.producto.create({
      data: {
        tenantId: tenant.id,
        nombre: `Prod-${uniqueId('prod')}`,
        precio: 10,
        categoriaId: categoria.id,
        disponible: true
      }
    });
    pedido = await prisma.pedido.create({
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

    const categoria2 = await prisma.categoria.create({
      data: { tenantId: tenantSecundario.id, nombre: `Cat-${uniqueId('cat2')}`, orden: 1, activa: true }
    });
    const producto2 = await prisma.producto.create({
      data: {
        tenantId: tenantSecundario.id,
        nombre: `Prod-${uniqueId('prod2')}`,
        precio: 10,
        categoriaId: categoria2.id,
        disponible: true
      }
    });
    const pedido2 = await prisma.pedido.create({
      data: {
        tenantId: tenantSecundario.id,
        tipo: 'MOSTRADOR',
        subtotal: 10,
        total: 10
      }
    });
    await prisma.pedidoItem.create({
      data: {
        tenantId: tenantSecundario.id,
        pedidoId: pedido2.id,
        productoId: producto2.id,
        cantidad: 1,
        precioUnitario: 10,
        subtotal: 10
      }
    });

    await request(app)
      .post(`/api/impresion/comanda/${pedido2.id}`)
      .set('Authorization', authHeader(tokenSecundario))
      .send({})
      .expect(200);
  });

  afterAll(async () => {
    await cleanupTenantData(tenant.id);
    await cleanupTenantData(tenantSecundario.id);
    await prisma.$disconnect();
  });

  it('POST /api/impresion/comanda/:pedidoId encola jobs (tenant scoped)', async () => {
    const response = await request(app)
      .post(`/api/impresion/comanda/${pedido.id}`)
      .set('Authorization', authHeader(token))
      .send({})
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.total).toBe(3);
    expect(response.body.batchId).toBeDefined();

    const jobs = await prisma.printJob.findMany({
      where: { tenantId: tenant.id, pedidoId: pedido.id }
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

  it('Bridge: POST /api/impresion/jobs/claim requiere x-tenant-slug', async () => {
    const response = await request(app)
      .post('/api/impresion/jobs/claim')
      .set('x-bridge-token', process.env.BRIDGE_TOKEN)
      .send({ bridgeId: 'bridge-test', limit: 1 })
      .expect(400);

    expect(response.body.error.message).toBe('Slug de restaurante requerido');
  });

  it('Bridge: claim/ack/fail opera solo sobre jobs del tenant', async () => {
    const claimed = await request(app)
      .post('/api/impresion/jobs/claim')
      .set('x-bridge-token', process.env.BRIDGE_TOKEN)
      .set('x-tenant-slug', tenant.slug)
      .send({ bridgeId: 'bridge-test', limit: 3 })
      .expect(200);

    expect(claimed.body.jobs.length).toBeGreaterThan(0);
    expect(claimed.body.jobs.length).toBeLessThanOrEqual(3);
    expect(claimed.body.jobs.every(j => j.tenantId === tenant.id)).toBe(true);

    const [jobA, jobB] = claimed.body.jobs;
    expect(jobA).toBeDefined();
    expect(jobB).toBeDefined();

    await request(app)
      .post(`/api/impresion/jobs/${jobA.id}/ack`)
      .set('x-bridge-token', process.env.BRIDGE_TOKEN)
      .set('x-tenant-slug', tenant.slug)
      .send({ bridgeId: 'bridge-test' })
      .expect(200);

    const jobAUpdated = await prisma.printJob.findUnique({ where: { id: jobA.id } });
    expect(jobAUpdated.status).toBe('OK');

    await request(app)
      .post(`/api/impresion/jobs/${jobB.id}/fail`)
      .set('x-bridge-token', process.env.BRIDGE_TOKEN)
      .set('x-tenant-slug', tenant.slug)
      .send({ bridgeId: 'bridge-test', error: 'Printer error' })
      .expect(200);

    const jobBUpdated = await prisma.printJob.findUnique({ where: { id: jobB.id } });
    expect(['PENDIENTE', 'ERROR']).toContain(jobBUpdated.status);
  });
});

