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

describe('Ingredientes Endpoints', () => {
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

  it('POST /api/ingredientes crea ingrediente y movimiento inicial', async () => {
    const response = await request(app)
      .post('/api/ingredientes')
      .set('Authorization', authHeader(token))
      .send({
        nombre: 'Harina',
        unidad: 'kg',
        stockActual: 5,
        stockMinimo: 1,
        costo: 100
      })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(response.body.tenantId).toBe(tenant.id);

    const detalle = await request(app)
      .get(`/api/ingredientes/${response.body.id}`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(detalle.body.movimientos.length).toBeGreaterThan(0);
    expect(detalle.body.movimientos[0].tipo).toBe('ENTRADA');
    expect(detalle.body.movimientos[0].motivo).toBe('Stock inicial');
  });

  it('POST /api/ingredientes/:id/movimiento valida stock insuficiente', async () => {
    const ingrediente = await prisma.ingrediente.create({
      data: {
        tenantId: tenant.id,
        nombre: `Ing-${uniqueId('i')}`,
        unidad: 'unidades',
        stockActual: 1,
        stockMinimo: 0,
        activo: true
      }
    });

    const response = await request(app)
      .post(`/api/ingredientes/${ingrediente.id}/movimiento`)
      .set('Authorization', authHeader(token))
      .send({ tipo: 'SALIDA', cantidad: 10, motivo: 'Prueba' })
      .expect(400);

    expect(response.body.error.message).toBe('Stock insuficiente');
  });

  it('POST /api/ingredientes/:id/ajuste registra AJUSTE y actualiza stock', async () => {
    const ingrediente = await prisma.ingrediente.create({
      data: {
        tenantId: tenant.id,
        nombre: `Ing-${uniqueId('aj')}`,
        unidad: 'kg',
        stockActual: 2,
        stockMinimo: 0,
        activo: true
      }
    });

    const response = await request(app)
      .post(`/api/ingredientes/${ingrediente.id}/ajuste`)
      .set('Authorization', authHeader(token))
      .send({ stockReal: 7, motivo: 'Conteo' })
      .expect(200);

    expect(Number(response.body.stockActual)).toBe(7);

    const detalle = await request(app)
      .get(`/api/ingredientes/${ingrediente.id}`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(detalle.body.movimientos[0].tipo).toBe('AJUSTE');
    expect(Number(detalle.body.movimientos[0].cantidad)).toBe(5);
  });

  it('GET /api/ingredientes/alertas devuelve solo ingredientes activos con stock bajo', async () => {
    const ingredienteBajo = await prisma.ingrediente.create({
      data: {
        tenantId: tenant.id,
        nombre: `Ing-${uniqueId('bajo')}`,
        unidad: 'kg',
        stockActual: 1,
        stockMinimo: 2,
        activo: true
      }
    });

    await prisma.ingrediente.create({
      data: {
        tenantId: tenant.id,
        nombre: `Ing-${uniqueId('ok')}`,
        unidad: 'kg',
        stockActual: 10,
        stockMinimo: 2,
        activo: true
      }
    });

    await prisma.ingrediente.create({
      data: {
        tenantId: tenant.id,
        nombre: `Ing-${uniqueId('inact')}`,
        unidad: 'kg',
        stockActual: 0,
        stockMinimo: 2,
        activo: false
      }
    });

    const response = await request(app)
      .get('/api/ingredientes/alertas')
      .set('Authorization', authHeader(token))
      .expect(200);

    const ids = response.body.map(ing => ing.id);
    expect(ids).toContain(ingredienteBajo.id);
    expect(response.body.every(ing => ing.activo === true)).toBe(true);
  });
});
