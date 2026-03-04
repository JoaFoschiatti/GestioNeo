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

const formatDateOnly = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

describe('Reportes Endpoints', () => {
  let admin;
  let token;
  let tokenMozo;

  beforeAll(async () => {
    await cleanupTestData();
    await ensureActiveSuscripcion();
    admin = await createUsuario({
      email: `${uniqueId('admin')}@example.com`,
      rol: 'ADMIN',
      nombre: 'Admin Reportes'
    });
    token = signTokenForUser(admin);

    const mozo = await createUsuario({
      email: `${uniqueId('mozo')}@example.com`,
      rol: 'MOZO'
    });
    tokenMozo = signTokenForUser(mozo);
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it('GET /api/reportes/dashboard devuelve metricas', async () => {
    await prisma.mesa.createMany({
      data: [
        { numero: 1, capacidad: 4, estado: 'OCUPADA', activa: true },
        { numero: 2, capacidad: 4, estado: 'LIBRE', activa: true }
      ]
    });

    await prisma.ingrediente.createMany({
      data: [
        {
          nombre: `Ing-${uniqueId('bajo')}`,
          unidad: 'u',
          stockActual: 5,
          stockMinimo: 10,
          costo: 1,
          activo: true
        },
        {
          nombre: `Ing-${uniqueId('ok')}`,
          unidad: 'u',
          stockActual: 20,
          stockMinimo: 10,
          costo: 1,
          activo: true
        }
      ]
    });

    const empleado = await prisma.empleado.create({
      data: {
        nombre: 'Emp',
        apellido: 'Test',
        dni: uniqueId('dni'),
        rol: 'MOZO',
        tarifaHora: 100,
        activo: true
      }
    });

    const ahora = new Date();
    await prisma.fichaje.create({
      data: {
        empleadoId: empleado.id,
        entrada: ahora,
        salida: null,
        fecha: ahora
      }
    });

    await prisma.pedido.createMany({
      data: [
        { tipo: 'MOSTRADOR', estado: 'COBRADO', subtotal: 100, total: 100 },
        { tipo: 'MOSTRADOR', estado: 'PENDIENTE', subtotal: 50, total: 50 },
        { tipo: 'MOSTRADOR', estado: 'EN_PREPARACION', subtotal: 30, total: 30 }
      ]
    });

    const response = await request(app)
      .get('/api/reportes/dashboard')
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(response.body).toEqual(expect.objectContaining({
      ventasHoy: 180,
      pedidosHoy: 3,
      pedidosPendientes: 2,
      mesasOcupadas: 1,
      mesasTotal: 2,
      alertasStock: 1,
      empleadosTrabajando: 1
    }));
  });

  it('GET /api/reportes/ventas requiere fechaDesde/fechaHasta', async () => {
    const response = await request(app)
      .get('/api/reportes/ventas')
      .set('Authorization', authHeader(token))
      .expect(400);

    expect(response.body.error.message).toBe('Datos inválidos');
  });

  it('GET /api/reportes/ventas calcula totales y ventas por metodo', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat')}`, orden: 1, activa: true }
    });

    const productoA = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('a')}`,
        precio: 100,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    const productoB = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('b')}`,
        precio: 50,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    const createdAt = new Date(2030, 0, 15, 12, 0, 0);
    const fecha = formatDateOnly(createdAt);

    const pedido1 = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        estado: 'COBRADO',
        usuarioId: admin.id,
        subtotal: 100,
        total: 100,
        createdAt
      }
    });

    await prisma.pedidoItem.create({
      data: {
        pedidoId: pedido1.id,
        productoId: productoA.id,
        cantidad: 1,
        precioUnitario: 100,
        subtotal: 100
      }
    });

    await prisma.pago.createMany({
      data: [
        { pedidoId: pedido1.id, monto: 40, metodo: 'EFECTIVO', estado: 'APROBADO' },
        { pedidoId: pedido1.id, monto: 60, metodo: 'TARJETA', estado: 'APROBADO' }
      ]
    });

    const pedido2 = await prisma.pedido.create({
      data: {
        tipo: 'DELIVERY',
        estado: 'COBRADO',
        usuarioId: null,
        subtotal: 50,
        total: 50,
        createdAt
      }
    });

    await prisma.pedidoItem.create({
      data: {
        pedidoId: pedido2.id,
        productoId: productoB.id,
        cantidad: 1,
        precioUnitario: 50,
        subtotal: 50
      }
    });

    await prisma.pago.create({
      data: {
        pedidoId: pedido2.id,
        monto: 50,
        metodo: 'MERCADOPAGO',
        estado: 'APROBADO'
      }
    });

    const response = await request(app)
      .get(`/api/reportes/ventas?fechaDesde=${fecha}&fechaHasta=${fecha}`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(response.body.totalPedidos).toBe(2);
    expect(response.body.totalVentas).toBe(150);
    expect(response.body.ticketPromedio).toBe(75);

    expect(response.body.ventasPorMetodo).toEqual(expect.objectContaining({
      EFECTIVO: 40,
      TARJETA: 60,
      MERCADOPAGO: 50
    }));

    expect(response.body.ventasPorTipo).toEqual(expect.objectContaining({
      MOSTRADOR: { cantidad: 1, total: 100 },
      DELIVERY: { cantidad: 1, total: 50 }
    }));
  });

  it('GET /api/reportes/productos-mas-vendidos agrupa por producto base', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat')}`, orden: 1, activa: true }
    });

    const base = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('base')}`,
        precio: 100,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    const variante = await prisma.producto.create({
      data: {
        nombre: `${base.nombre} Doble`,
        nombreVariante: 'Doble',
        precio: 150,
        categoriaId: categoria.id,
        disponible: true,
        productoBaseId: base.id,
        ordenVariante: 1,
        esVariantePredeterminada: true
      }
    });

    const createdAt = new Date(2030, 0, 16, 12, 0, 0);
    const fecha = formatDateOnly(createdAt);

    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        estado: 'COBRADO',
        subtotal: 400,
        total: 400,
        createdAt
      }
    });

    await prisma.pedidoItem.createMany({
      data: [
        {
          pedidoId: pedido.id,
          productoId: base.id,
          cantidad: 1,
          precioUnitario: 100,
          subtotal: 100
        },
        {
          pedidoId: pedido.id,
          productoId: variante.id,
          cantidad: 2,
          precioUnitario: 150,
          subtotal: 300
        }
      ]
    });

    const response = await request(app)
      .get(`/api/reportes/productos-mas-vendidos?fechaDesde=${fecha}&fechaHasta=${fecha}&agruparPorBase=true&limite=10`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    const entry = response.body.find(r => r.productoBaseId === base.id);
    expect(entry).toBeDefined();
    expect(entry.cantidadVendida).toBe(3);
    expect(entry.totalVentas).toBe(400);
    expect(entry.variantes).toHaveLength(1);
    expect(entry.variantes[0].nombreVariante).toBe('Doble');
    expect(entry.variantes[0].cantidadVendida).toBe(2);
    expect(Number(entry.variantes[0].totalVentas)).toBe(300);
  });

  it('GET /api/reportes/ventas-por-mozo distingue menu publico vs usuario', async () => {
    const createdAt = new Date(2030, 0, 18, 12, 0, 0);
    const fecha = formatDateOnly(createdAt);

    await prisma.pedido.createMany({
      data: [
        {
          tipo: 'MOSTRADOR',
          estado: 'COBRADO',
          usuarioId: admin.id,
          subtotal: 100,
          total: 100,
          createdAt
        },
        {
          tipo: 'MOSTRADOR',
          estado: 'COBRADO',
          usuarioId: null,
          subtotal: 50,
          total: 50,
          createdAt
        }
      ]
    });

    const response = await request(app)
      .get(`/api/reportes/ventas-por-mozo?fechaDesde=${fecha}&fechaHasta=${fecha}`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);

    const menuPublico = response.body.find(r => r.mozo === 'Menú Público');
    expect(menuPublico).toBeDefined();
    expect(menuPublico.pedidos).toBe(1);
    expect(Number(menuPublico.totalVentas)).toBe(50);

    const adminEntry = response.body.find(r => r.mozo === admin.nombre);
    expect(adminEntry).toBeDefined();
    expect(adminEntry.pedidos).toBe(1);
    expect(Number(adminEntry.totalVentas)).toBe(100);
  });

  it('GET /api/reportes/consumo-insumos calcula consumo con multiplicador', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat')}`, orden: 1, activa: true }
    });

    const ingrediente = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('ing')}`,
        unidad: 'kg',
        stockActual: 100,
        stockMinimo: 10,
        costo: 5,
        activo: true
      }
    });

    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('prod')}`,
        precio: 100,
        categoriaId: categoria.id,
        disponible: true,
        multiplicadorInsumos: 2.0
      }
    });

    await prisma.productoIngrediente.create({
      data: {
        productoId: producto.id,
        ingredienteId: ingrediente.id,
        cantidad: 0.5
      }
    });

    const createdAt = new Date(2030, 0, 17, 12, 0, 0);
    const fecha = formatDateOnly(createdAt);

    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        estado: 'COBRADO',
        subtotal: 300,
        total: 300,
        createdAt
      }
    });

    await prisma.pedidoItem.create({
      data: {
        pedidoId: pedido.id,
        productoId: producto.id,
        cantidad: 3,
        precioUnitario: 100,
        subtotal: 300
      }
    });

    const response = await request(app)
      .get(`/api/reportes/consumo-insumos?fechaDesde=${fecha}&fechaHasta=${fecha}`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(response.body.resumen.totalIngredientes).toBe(1);

    const row = response.body.ingredientes.find(r => r.ingredienteId === ingrediente.id);
    expect(row).toBeDefined();
    expect(row.consumoTotal).toBeCloseTo(3, 6);
    expect(row.estado).toBe('OK');
    expect(row.detalleProductos).toHaveLength(1);
    expect(row.detalleProductos[0]).toEqual(expect.objectContaining({
      producto: producto.nombre,
      multiplicador: 2,
      cantidad: 3
    }));
    expect(row.detalleProductos[0].consumo).toBeCloseTo(3, 6);
  });

  // A3: Auditoria de anulaciones
  it('GET /api/reportes/auditoria-anulaciones lista anulaciones', async () => {
    // Create and cancel a pedido to generate audit record
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('aud')}`, orden: 1, activa: true }
    });

    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('aud')}`,
        precio: 75,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    const pedidoCreado = await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader(token))
      .send({
        tipo: 'MOSTRADOR',
        items: [{ productoId: producto.id, cantidad: 1 }]
      })
      .expect(201);

    await request(app)
      .post(`/api/pedidos/${pedidoCreado.body.id}/cancelar`)
      .set('Authorization', authHeader(token))
      .send({ motivo: 'Test auditoria' })
      .expect(200);

    const response = await request(app)
      .get('/api/reportes/auditoria-anulaciones')
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    const entry = response.body.find(a => a.pedidoId === pedidoCreado.body.id);
    expect(entry).toBeDefined();
    expect(entry.tipo).toBe('CANCELACION_PEDIDO');
    expect(entry.motivo).toBe('Test auditoria');
    expect(entry.usuario).toBeDefined();
    expect(entry.pedido).toBeDefined();
  });

  it('GET /api/reportes/auditoria-anulaciones filtra por fecha', async () => {
    const response = await request(app)
      .get('/api/reportes/auditoria-anulaciones?fechaDesde=2099-01-01&fechaHasta=2099-12-31')
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it('GET /api/reportes/auditoria-anulaciones requiere permisos avanzados', async () => {
    await request(app)
      .get('/api/reportes/auditoria-anulaciones')
      .set('Authorization', authHeader(tokenMozo))
      .expect(403);
  });

  // B3: Gastos por categoria
  it('GET /api/reportes/gastos agrupa por categoriaGasto', async () => {
    const ingrediente1 = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('g1')}`,
        unidad: 'kg',
        stockActual: 50,
        stockMinimo: 0,
        activo: true
      }
    });

    const ingrediente2 = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('g2')}`,
        unidad: 'u',
        stockActual: 100,
        stockMinimo: 0,
        activo: true
      }
    });

    const ahora = new Date();
    const fecha = formatDateOnly(ahora);

    await prisma.movimientoStock.createMany({
      data: [
        {
          ingredienteId: ingrediente1.id,
          tipo: 'ENTRADA',
          cantidad: 10,
          categoriaGasto: 'Carnes',
          costoUnitario: 200,
          costoTotal: 2000,
          createdAt: ahora
        },
        {
          ingredienteId: ingrediente2.id,
          tipo: 'ENTRADA',
          cantidad: 20,
          categoriaGasto: 'Verduras',
          costoUnitario: 50,
          costoTotal: 1000,
          createdAt: ahora
        },
        {
          ingredienteId: ingrediente1.id,
          tipo: 'ENTRADA',
          cantidad: 5,
          categoriaGasto: 'Carnes',
          costoUnitario: 200,
          costoTotal: 1000,
          createdAt: ahora
        }
      ]
    });

    const response = await request(app)
      .get(`/api/reportes/gastos?fechaDesde=${fecha}&fechaHasta=${fecha}`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(response.body.porCategoria).toBeDefined();

    const carnes = response.body.porCategoria.find(c => c.categoria === 'Carnes');
    expect(carnes).toBeDefined();
    expect(carnes.total).toBe(3000);
    expect(carnes.cantidad).toBe(2);

    const verduras = response.body.porCategoria.find(c => c.categoria === 'Verduras');
    expect(verduras).toBeDefined();
    expect(verduras.total).toBe(1000);

    expect(response.body.totalGastos).toBe(4000);
  });
});
