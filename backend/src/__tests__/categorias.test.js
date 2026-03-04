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

describe('Categorias Endpoints', () => {
  let token;

  beforeAll(async () => {
    await cleanupTestData();
    await ensureActiveSuscripcion();
    const admin = await createUsuario({
      email: `${uniqueId('admin')}@example.com`,
      rol: 'ADMIN'
    });
    token = signTokenForUser(admin);

    await prisma.categoria.create({
      data: {
        nombre: 'Categoria Otro Tenant',
        orden: 1,
        activa: true
      }
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it('POST /api/categorias crea una categoria', async () => {
    const response = await request(app)
      .post('/api/categorias')
      .set('Authorization', authHeader(token))
      .send({ nombre: 'Burgers', descripcion: 'Hamburguesas', orden: 10 })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(response.body.nombre).toBe('Burgers');
    expect(response.body.activa).toBe(true);
  });

  it('POST /api/categorias rechaza duplicados', async () => {
    await request(app)
      .post('/api/categorias')
      .set('Authorization', authHeader(token))
      .send({ nombre: 'Papas' })
      .expect(201);

    const response = await request(app)
      .post('/api/categorias')
      .set('Authorization', authHeader(token))
      .send({ nombre: 'Papas' })
      .expect(400);

    expect(response.body.error.message).toBe('Ya existe una categoría con ese nombre');
  });

  it('GET /api/categorias lista categorias', async () => {
    await prisma.categoria.create({
      data: {
        nombre: 'Bebidas',
        orden: 2,
        activa: true
      }
    });

    const response = await request(app)
      .get('/api/categorias')
      .set('Authorization', authHeader(token))
      .expect(200);

    const nombres = response.body.map(c => c.nombre);
    expect(nombres).toContain('Bebidas');
  });

  it('DELETE /api/categorias falla si hay productos asociados', async () => {
    const categoria = await prisma.categoria.create({
      data: {
        nombre: `Cat-${uniqueId('prod')}`,
        orden: 3,
        activa: true
      }
    });

    await prisma.producto.create({
      data: {
        nombre: `Producto-${uniqueId('p')}`,
        precio: 10,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    const response = await request(app)
      .delete(`/api/categorias/${categoria.id}`)
      .set('Authorization', authHeader(token))
      .expect(400);

    expect(response.body.error.message).toBe('No se puede eliminar: la categoría tiene productos asociados');
  });

  it('GET /api/categorias/publicas devuelve solo activas y filtra productos disponibles', async () => {
    const categoriaActiva = await prisma.categoria.create({
      data: {
        nombre: `Cat-${uniqueId('pub')}`,
        orden: 1,
        activa: true
      }
    });

    const categoriaInactiva = await prisma.categoria.create({
      data: {
        nombre: `Cat-${uniqueId('priv')}`,
        orden: 2,
        activa: false
      }
    });

    const productoDisponible = await prisma.producto.create({
      data: {
        nombre: `Producto-${uniqueId('disp')}`,
        precio: 10,
        categoriaId: categoriaActiva.id,
        disponible: true
      }
    });

    await prisma.producto.create({
      data: {
        nombre: `Producto-${uniqueId('nodisp')}`,
        precio: 10,
        categoriaId: categoriaActiva.id,
        disponible: false
      }
    });

    await prisma.producto.create({
      data: {
        nombre: `Producto-${uniqueId('inact')}`,
        precio: 10,
        categoriaId: categoriaInactiva.id,
        disponible: true
      }
    });

    const response = await request(app)
      .get('/api/categorias/publicas')
      .set('Authorization', authHeader(token))
      .expect(200);

    const ids = response.body.map(c => c.id);
    expect(ids).toContain(categoriaActiva.id);
    expect(ids).not.toContain(categoriaInactiva.id);

    const categoria = response.body.find(c => c.id === categoriaActiva.id);
    expect(categoria.productos.map(p => p.id)).toContain(productoDisponible.id);
    expect(categoria.productos.some(p => p.disponible === false)).toBe(false);
  });
});
