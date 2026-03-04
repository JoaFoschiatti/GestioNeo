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

describe('Productos Endpoints', () => {
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

  it('POST /api/productos crea producto con ingredientes', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat')}`, orden: 1, activa: true }
    });

    const ingrediente = await prisma.ingrediente.create({
      data: {
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

  it('GET /api/productos lista productos', async () => {
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

    const response = await request(app)
      .get('/api/productos')
      .set('Authorization', authHeader(token))
      .expect(200);

    const ids = response.body.map(p => p.id);
    expect(ids).toContain(producto.id);
  });

  it('POST /api/productos/:id/variantes crea una variante y copia ingredientes', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat')}`, orden: 1, activa: true }
    });
    const ingrediente = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('ing')}`,
        unidad: 'u',
        stockActual: 100,
        stockMinimo: 10,
        costo: 1
      }
    });

    const productoBase = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('base')}`,
        precio: 100,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    await prisma.productoIngrediente.create({
      data: {
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
});
