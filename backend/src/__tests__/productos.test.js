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

describe('Productos Endpoints', () => {
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

  it('POST /api/productos crea producto con ingredientes', async () => {
    const categoria = await prisma.categoria.create({
      data: { tenantId: tenant.id, nombre: `Cat-${uniqueId('cat')}`, orden: 1, activa: true }
    });

    const ingrediente = await prisma.ingrediente.create({
      data: {
        tenantId: tenant.id,
        nombre: `Ing-${uniqueId('ing')}`,
        unidad: 'u',
        stockActual: 100,
        stockMinimo: 10,
        costo: 1
      }
    });

    const response = await request(app)
      .post('/api/productos')
      .set('Authorization', authHeader(token))
      .send({
        nombre: `Prod-${uniqueId('prod')}`,
        descripcion: 'Producto test',
        precio: 123,
        categoriaId: categoria.id,
        disponible: true,
        destacado: false,
        ingredientes: [{ ingredienteId: ingrediente.id, cantidad: 2 }]
      })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(response.body.categoriaId).toBe(categoria.id);
    expect(response.body.categoria?.id).toBe(categoria.id);
    expect(response.body.ingredientes).toHaveLength(1);
    expect(response.body.ingredientes[0].ingredienteId).toBe(ingrediente.id);
  });

  it('GET /api/productos lista solo productos del tenant', async () => {
    const categoria = await prisma.categoria.create({
      data: { tenantId: tenant.id, nombre: `Cat-${uniqueId('cat')}`, orden: 1, activa: true }
    });
    const categoriaOtroTenant = await prisma.categoria.create({
      data: { tenantId: tenantSecundario.id, nombre: `Cat-${uniqueId('cat2')}`, orden: 1, activa: true }
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
    await prisma.producto.create({
      data: {
        tenantId: tenantSecundario.id,
        nombre: `Prod-${uniqueId('prod2')}`,
        precio: 10,
        categoriaId: categoriaOtroTenant.id,
        disponible: true
      }
    });

    const response = await request(app)
      .get('/api/productos')
      .set('Authorization', authHeader(token))
      .expect(200);

    const ids = response.body.map(p => p.id);
    expect(ids).toContain(producto.id);
    expect(response.body.every(p => p.tenantId === tenant.id)).toBe(true);
  });

  it('POST /api/productos/:id/variantes crea una variante y copia ingredientes', async () => {
    const categoria = await prisma.categoria.create({
      data: { tenantId: tenant.id, nombre: `Cat-${uniqueId('cat')}`, orden: 1, activa: true }
    });
    const ingrediente = await prisma.ingrediente.create({
      data: {
        tenantId: tenant.id,
        nombre: `Ing-${uniqueId('ing')}`,
        unidad: 'u',
        stockActual: 100,
        stockMinimo: 10,
        costo: 1
      }
    });

    const productoBase = await prisma.producto.create({
      data: {
        tenantId: tenant.id,
        nombre: `Prod-${uniqueId('base')}`,
        precio: 100,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    await prisma.productoIngrediente.create({
      data: {
        tenantId: tenant.id,
        productoId: productoBase.id,
        ingredienteId: ingrediente.id,
        cantidad: 1
      }
    });

    const response = await request(app)
      .post(`/api/productos/${productoBase.id}/variantes`)
      .set('Authorization', authHeader(token))
      .send({
        nombreVariante: 'Doble',
        precio: 150,
        multiplicadorInsumos: 2,
        ordenVariante: 1,
        esVariantePredeterminada: true
      })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(response.body.productoBaseId).toBe(productoBase.id);
    expect(response.body.ingredientes).toHaveLength(1);
    expect(response.body.ingredientes[0].ingredienteId).toBe(ingrediente.id);

    const listado = await request(app)
      .get('/api/productos/con-variantes')
      .set('Authorization', authHeader(token))
      .expect(200);

    const baseEnRespuesta = listado.body.find(p => p.id === productoBase.id);
    expect(baseEnRespuesta).toBeDefined();
    expect(baseEnRespuesta.variantes.some(v => v.id === response.body.id)).toBe(true);
  });

  it('Aislamiento multi-tenant: GET /api/productos/:id no devuelve producto de otro tenant', async () => {
    const categoriaOtroTenant = await prisma.categoria.create({
      data: { tenantId: tenantSecundario.id, nombre: `Cat-${uniqueId('cat')}`, orden: 1, activa: true }
    });
    const productoOtroTenant = await prisma.producto.create({
      data: {
        tenantId: tenantSecundario.id,
        nombre: `Prod-${uniqueId('otro')}`,
        precio: 10,
        categoriaId: categoriaOtroTenant.id,
        disponible: true
      }
    });

    const response = await request(app)
      .get(`/api/productos/${productoOtroTenant.id}`)
      .set('Authorization', authHeader(token))
      .expect(404);

    expect(response.body.error.message).toBe('Producto no encontrado');
  });

  it('POST /api/productos/agrupar-variantes rechaza ids de otro tenant', async () => {
    const categoria = await prisma.categoria.create({
      data: { tenantId: tenant.id, nombre: `Cat-${uniqueId('cat')}`, orden: 1, activa: true }
    });
    const categoriaOtroTenant = await prisma.categoria.create({
      data: { tenantId: tenantSecundario.id, nombre: `Cat-${uniqueId('cat2')}`, orden: 1, activa: true }
    });

    const productoBase = await prisma.producto.create({
      data: {
        tenantId: tenant.id,
        nombre: `Prod-${uniqueId('base')}`,
        precio: 10,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    const productoOtroTenant = await prisma.producto.create({
      data: {
        tenantId: tenantSecundario.id,
        nombre: `Prod-${uniqueId('otro')}`,
        precio: 10,
        categoriaId: categoriaOtroTenant.id,
        disponible: true
      }
    });

    const response = await request(app)
      .post('/api/productos/agrupar-variantes')
      .set('Authorization', authHeader(token))
      .send({
        productoBaseId: productoBase.id,
        variantes: [
          {
            productoId: productoOtroTenant.id,
            nombreVariante: 'Otro',
            ordenVariante: 1
          }
        ]
      })
      .expect(400);

    expect(response.body.error.message).toMatch(/Productos no válidos/);
  });
});
