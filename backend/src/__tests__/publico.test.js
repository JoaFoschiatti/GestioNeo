const request = require('supertest');
const app = require('../app');
const {
  prisma,
  uniqueId,
  cleanupTestData,
  ensureActiveSuscripcion
} = require('./helpers/test-helpers');

describe('Publico Endpoints', () => {
  let negocio;

  beforeAll(async () => {
    await cleanupTestData();
    await ensureActiveSuscripcion();
    negocio = await prisma.negocio.upsert({
      where: { id: 1 },
      update: { nombre: 'Test Negocio' },
      create: { nombre: 'Test Negocio', email: 'test@example.com' }
    });
  });

  afterEach(async () => {
    await prisma.configuracion.deleteMany({
      where: {
        clave: { in: ['delivery_habilitado', 'efectivo_enabled', 'mercadopago_enabled', 'tienda_abierta', 'costo_delivery'] }
      }
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it('GET /api/publico/config devuelve defaults y negocio info', async () => {
    const response = await request(app)
      .get('/api/publico/config')
      .expect(200);

    expect(response.body.negocio.nombre).toBe(negocio.nombre);
    expect(response.body.config.tienda_abierta).toBe(true);
    expect(response.body.config.efectivo_enabled).toBe(true);
    expect(response.body.config.mercadopago_enabled).toBe(false);
  });

  it('GET /api/publico/menu filtra categorías/productos y expone variantes', async () => {
    const categoriaActiva = await prisma.categoria.create({
      data: {
        nombre: `Cat-${uniqueId('activa')}`,
        orden: 1,
        activa: true
      }
    });

    const categoriaInactiva = await prisma.categoria.create({
      data: {
        nombre: `Cat-${uniqueId('inactiva')}`,
        orden: 2,
        activa: false
      }
    });

    const productoBase = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('base')}`,
        precio: 100,
        categoriaId: categoriaActiva.id,
        disponible: true
      }
    });

    const productoNoDisponible = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('nodisp')}`,
        precio: 50,
        categoriaId: categoriaActiva.id,
        disponible: false
      }
    });

    const varianteDisponible = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('var')}`,
        nombreVariante: 'Doble',
        precio: 150,
        categoriaId: categoriaActiva.id,
        disponible: true,
        productoBaseId: productoBase.id,
        ordenVariante: 1
      }
    });

    const varianteNoDisponible = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('var-no')}`,
        nombreVariante: 'Triple',
        precio: 200,
        categoriaId: categoriaActiva.id,
        disponible: false,
        productoBaseId: productoBase.id,
        ordenVariante: 2
      }
    });

    // Producto en categoría inactiva (no debería aparecer)
    await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('cat-inactiva')}`,
        precio: 10,
        categoriaId: categoriaInactiva.id,
        disponible: true
      }
    });

    const response = await request(app)
      .get('/api/publico/menu')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);

    const categoria = response.body.find(c => c.id === categoriaActiva.id);
    expect(categoria).toBeDefined();
    expect(response.body.some(c => c.id === categoriaInactiva.id)).toBe(false);

    const idsProductos = categoria.productos.map(p => p.id);
    expect(idsProductos).toContain(productoBase.id);
    expect(idsProductos).not.toContain(productoNoDisponible.id);
    expect(idsProductos).not.toContain(varianteDisponible.id);

    const baseEnRespuesta = categoria.productos.find(p => p.id === productoBase.id);
    const idsVariantes = baseEnRespuesta.variantes.map(v => v.id);
    expect(idsVariantes).toContain(varianteDisponible.id);
    expect(idsVariantes).not.toContain(varianteNoDisponible.id);
  });

  it('POST /api/publico/pedido crea pedido y permite items duplicados', async () => {
    const categoria = await prisma.categoria.create({
      data: {
        nombre: `Cat-${uniqueId('pedido')}`,
        orden: 1,
        activa: true
      }
    });

    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('pedido')}`,
        precio: 123,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    const response = await request(app)
      .post('/api/publico/pedido')
      .send({
        items: [
          { productoId: producto.id, cantidad: 1 },
          { productoId: producto.id, cantidad: 2 }
        ],
        clienteNombre: 'Cliente Test',
        clienteTelefono: '3410000000',
        tipoEntrega: 'RETIRO',
        metodoPago: 'EFECTIVO'
      })
      .expect(201);

    expect(response.body.message).toBe('Pedido creado correctamente');
    expect(response.body.initPoint).toBe(null);
    expect(response.body.pedido.origen).toBe('MENU_PUBLICO');
    expect(response.body.pedido.items).toHaveLength(2);
  });

  it('POST /api/publico/pedido rechaza delivery si está deshabilitado', async () => {
    const categoria = await prisma.categoria.create({
      data: {
        nombre: `Cat-${uniqueId('delivery')}`,
        orden: 1,
        activa: true
      }
    });

    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('delivery')}`,
        precio: 100,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    await prisma.configuracion.create({
      data: {
        clave: 'delivery_habilitado',
        valor: 'false'
      }
    });

    const response = await request(app)
      .post('/api/publico/pedido')
      .send({
        items: [{ productoId: producto.id, cantidad: 1 }],
        clienteNombre: 'Cliente Test',
        clienteTelefono: '3410000000',
        clienteDireccion: 'Calle 123',
        tipoEntrega: 'DELIVERY',
        metodoPago: 'EFECTIVO'
      })
      .expect(400);

    expect(response.body.error.message).toBe('El delivery no está disponible en este momento');
  });

  it('POST /api/publico/pedido rechaza efectivo si está deshabilitado', async () => {
    const categoria = await prisma.categoria.create({
      data: {
        nombre: `Cat-${uniqueId('efectivo')}`,
        orden: 1,
        activa: true
      }
    });

    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('efectivo')}`,
        precio: 100,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    await prisma.configuracion.create({
      data: {
        clave: 'efectivo_enabled',
        valor: 'false'
      }
    });

    const response = await request(app)
      .post('/api/publico/pedido')
      .send({
        items: [{ productoId: producto.id, cantidad: 1 }],
        clienteNombre: 'Cliente Test',
        clienteTelefono: '3410000000',
        tipoEntrega: 'RETIRO',
        metodoPago: 'EFECTIVO'
      })
      .expect(400);

    expect(response.body.error.message).toBe('El pago en efectivo no está disponible en este momento');
  });
});
