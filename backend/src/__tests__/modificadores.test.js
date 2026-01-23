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

describe('Modificadores Endpoints', () => {
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

  it('POST /api/modificadores crea EXCLUSION con precio 0', async () => {
    const response = await request(app)
      .post('/api/modificadores')
      .set('Authorization', authHeader(token))
      .send({ nombre: 'Sin cebolla', tipo: 'EXCLUSION', precio: 99 })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(Number(response.body.precio)).toBe(0);
    expect(response.body.tipo).toBe('EXCLUSION');
  });

  it('PUT /api/modificadores/:id fuerza precio 0 al cambiar a EXCLUSION', async () => {
    const creado = await request(app)
      .post('/api/modificadores')
      .set('Authorization', authHeader(token))
      .send({ nombre: 'Extra queso', tipo: 'ADICION', precio: 50 })
      .expect(201);

    const actualizado = await request(app)
      .put(`/api/modificadores/${creado.body.id}`)
      .set('Authorization', authHeader(token))
      .send({ tipo: 'EXCLUSION' })
      .expect(200);

    expect(actualizado.body.tipo).toBe('EXCLUSION');
    expect(Number(actualizado.body.precio)).toBe(0);
  });

  it('PUT /api/modificadores/producto/:productoId rechaza ids de otro tenant', async () => {
    const categoria = await prisma.categoria.create({
      data: {
        tenantId: tenant.id,
        nombre: `Cat-${uniqueId('m')}`,
        orden: 1,
        activa: true
      }
    });

    const producto = await prisma.producto.create({
      data: {
        tenantId: tenant.id,
        nombre: `Prod-${uniqueId('m')}`,
        precio: 10,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    const modOtroTenant = await prisma.modificador.create({
      data: {
        tenantId: tenantSecundario.id,
        nombre: `Mod-${uniqueId('otro')}`,
        tipo: 'ADICION',
        precio: 5,
        activo: true
      }
    });

    const response = await request(app)
      .put(`/api/modificadores/producto/${producto.id}`)
      .set('Authorization', authHeader(token))
      .send({ modificadorIds: [modOtroTenant.id] })
      .expect(400);

    expect(response.body.error.message).toContain('Modificadores inválidos');
  });

  it('PUT /api/modificadores/producto/:productoId asigna modificadores', async () => {
    const categoria = await prisma.categoria.create({
      data: {
        tenantId: tenant.id,
        nombre: `Cat-${uniqueId('asignar')}`,
        orden: 1,
        activa: true
      }
    });

    const producto = await prisma.producto.create({
      data: {
        tenantId: tenant.id,
        nombre: `Prod-${uniqueId('asignar')}`,
        precio: 10,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    const mod1 = await prisma.modificador.create({
      data: {
        tenantId: tenant.id,
        nombre: `Mod-${uniqueId('1')}`,
        tipo: 'ADICION',
        precio: 5,
        activo: true
      }
    });

    const mod2 = await prisma.modificador.create({
      data: {
        tenantId: tenant.id,
        nombre: `Mod-${uniqueId('2')}`,
        tipo: 'EXCLUSION',
        precio: 0,
        activo: true
      }
    });

    const response = await request(app)
      .put(`/api/modificadores/producto/${producto.id}`)
      .set('Authorization', authHeader(token))
      .send({ modificadorIds: [mod1.id, mod2.id] })
      .expect(200);

    const modificadoresAsignados = response.body.modificadores.map(pm => pm.modificador.nombre);
    expect(modificadoresAsignados).toEqual(expect.arrayContaining([mod1.nombre, mod2.nombre]));

    const listado = await request(app)
      .get(`/api/modificadores/producto/${producto.id}`)
      .set('Authorization', authHeader(token))
      .expect(200);

    const nombres = listado.body.map(m => m.nombre);
    expect(nombres).toEqual(expect.arrayContaining([mod1.nombre, mod2.nombre]));
  });
});

