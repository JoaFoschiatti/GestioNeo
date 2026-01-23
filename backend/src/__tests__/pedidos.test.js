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

describe('Pedidos Endpoints', () => {
  let tenant;
  let tokenAdmin;
  let tokenMozo;

  beforeAll(async () => {
    tenant = await createTenant();
    const admin = await createUsuario(tenant.id, {
      email: `${uniqueId('admin')}@example.com`,
      rol: 'ADMIN'
    });
    tokenAdmin = signTokenForUser(admin);

    const mozo = await createUsuario(tenant.id, {
      email: `${uniqueId('mozo')}@example.com`,
      rol: 'MOZO'
    });
    tokenMozo = signTokenForUser(mozo);
  });

  afterAll(async () => {
    await cleanupTenantData(tenant.id);
    await prisma.$disconnect();
  });

  it('POST /api/pedidos crea pedido MESA, aplica modificadores y ocupa mesa', async () => {
    const mesa = await prisma.mesa.create({
      data: {
        tenantId: tenant.id,
        numero: 1,
        capacidad: 4,
        estado: 'LIBRE',
        activa: true
      }
    });

    const categoria = await prisma.categoria.create({
      data: { tenantId: tenant.id, nombre: `Cat-${uniqueId('cat')}`, orden: 1, activa: true }
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

    const modificador = await prisma.modificador.create({
      data: {
        tenantId: tenant.id,
        nombre: `Extra-${uniqueId('mod')}`,
        precio: 3,
        tipo: 'ADICION',
        activo: true
      }
    });

    const response = await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader(tokenAdmin))
      .send({
        tipo: 'MESA',
        mesaId: mesa.id,
        items: [
          {
            productoId: producto.id,
            cantidad: 2,
            observaciones: 'Sin sal',
            modificadores: [modificador.id]
          }
        ]
      })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(response.body.tipo).toBe('MESA');
    expect(response.body.mesaId).toBe(mesa.id);
    expect(Number(response.body.subtotal)).toBe(26);
    expect(Number(response.body.total)).toBe(26);

    expect(response.body.items).toHaveLength(1);
    expect(Number(response.body.items[0].precioUnitario)).toBe(13);
    expect(Number(response.body.items[0].subtotal)).toBe(26);
    expect(response.body.items[0].modificadores).toHaveLength(1);
    expect(response.body.items[0].modificadores[0].modificadorId).toBe(modificador.id);
    expect(Number(response.body.items[0].modificadores[0].precio)).toBe(3);

    const mesaActualizada = await prisma.mesa.findUnique({ where: { id: mesa.id } });
    expect(mesaActualizada.estado).toBe('OCUPADA');
  });

  it('MOZO solo puede cambiar estado a ENTREGADO', async () => {
    const pedido = await prisma.pedido.create({
      data: {
        tenantId: tenant.id,
        tipo: 'MOSTRADOR',
        subtotal: 10,
        total: 10
      }
    });

    const forbidden = await request(app)
      .patch(`/api/pedidos/${pedido.id}/estado`)
      .set('Authorization', authHeader(tokenMozo))
      .send({ estado: 'EN_PREPARACION' })
      .expect(403);

    expect(forbidden.body.error.message).toBe('No tienes permiso para cambiar a este estado');

    const ok = await request(app)
      .patch(`/api/pedidos/${pedido.id}/estado`)
      .set('Authorization', authHeader(tokenMozo))
      .send({ estado: 'ENTREGADO' })
      .expect(200);

    expect(ok.body.estado).toBe('ENTREGADO');
  });

  it('PATCH /api/pedidos/:id/estado a EN_PREPARACION descuenta stock, registra movimientos y encola impresión', async () => {
    const categoria = await prisma.categoria.create({
      data: { tenantId: tenant.id, nombre: `Cat-${uniqueId('cat2')}`, orden: 1, activa: true }
    });

    const ingrediente = await prisma.ingrediente.create({
      data: {
        tenantId: tenant.id,
        nombre: `Ing-${uniqueId('ing')}`,
        unidad: 'u',
        stockActual: 10,
        stockMinimo: 0,
        activo: true
      }
    });

    const producto = await prisma.producto.create({
      data: {
        tenantId: tenant.id,
        nombre: `Prod-${uniqueId('prod2')}`,
        precio: 5,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    await prisma.productoIngrediente.create({
      data: {
        tenantId: tenant.id,
        productoId: producto.id,
        ingredienteId: ingrediente.id,
        cantidad: 2
      }
    });

    const pedidoCreado = await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader(tokenAdmin))
      .send({
        tipo: 'MOSTRADOR',
        items: [
          { productoId: producto.id, cantidad: 2 }
        ]
      })
      .expect(201);

    const pedidoId = pedidoCreado.body.id;

    const response = await request(app)
      .patch(`/api/pedidos/${pedidoId}/estado`)
      .set('Authorization', authHeader(tokenAdmin))
      .send({ estado: 'EN_PREPARACION' })
      .expect(200);

    expect(response.body.estado).toBe('EN_PREPARACION');
    expect(response.body.impresion).toBeDefined();
    expect(response.body.impresion.total).toBe(3);
    expect(response.body.impresion.batchId).toBeDefined();

    const ingredienteActualizado = await prisma.ingrediente.findUnique({ where: { id: ingrediente.id } });
    expect(Number(ingredienteActualizado.stockActual)).toBe(6);

    const movimientosSalida = await prisma.movimientoStock.findMany({
      where: { tenantId: tenant.id, pedidoId, ingredienteId: ingrediente.id, tipo: 'SALIDA' }
    });
    expect(movimientosSalida.length).toBe(1);
    expect(Number(movimientosSalida[0].cantidad)).toBe(4);

    const jobs = await prisma.printJob.findMany({
      where: { tenantId: tenant.id, pedidoId }
    });
    expect(jobs.length).toBe(3);

    const detalle = await request(app)
      .get(`/api/pedidos/${pedidoId}`)
      .set('Authorization', authHeader(tokenAdmin))
      .expect(200);

    expect(detalle.body.id).toBe(pedidoId);
    expect(detalle.body.impresion).toBeDefined();
    expect(detalle.body.impresion.total).toBe(3);
    expect(detalle.body.impresion.status).toBe('PENDIENTE');
    expect(detalle.body.printJobs).toBeUndefined();

    const listado = await request(app)
      .get('/api/pedidos?estado=EN_PREPARACION')
      .set('Authorization', authHeader(tokenAdmin))
      .expect(200);

    const ids = listado.body.map(p => p.id);
    expect(ids).toContain(pedidoId);
  });

  it('POST /api/pedidos/:id/cancelar restaura stock y libera mesa si ya estaba en preparación', async () => {
    const mesa = await prisma.mesa.create({
      data: {
        tenantId: tenant.id,
        numero: 50,
        capacidad: 4,
        estado: 'LIBRE',
        activa: true
      }
    });

    const categoria = await prisma.categoria.create({
      data: { tenantId: tenant.id, nombre: `Cat-${uniqueId('cat3')}`, orden: 1, activa: true }
    });

    const ingrediente = await prisma.ingrediente.create({
      data: {
        tenantId: tenant.id,
        nombre: `Ing-${uniqueId('ing2')}`,
        unidad: 'u',
        stockActual: 10,
        stockMinimo: 0,
        activo: true
      }
    });

    const producto = await prisma.producto.create({
      data: {
        tenantId: tenant.id,
        nombre: `Prod-${uniqueId('prod3')}`,
        precio: 5,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    await prisma.productoIngrediente.create({
      data: {
        tenantId: tenant.id,
        productoId: producto.id,
        ingredienteId: ingrediente.id,
        cantidad: 1
      }
    });

    const pedidoCreado = await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader(tokenAdmin))
      .send({
        tipo: 'MESA',
        mesaId: mesa.id,
        items: [
          { productoId: producto.id, cantidad: 2 }
        ]
      })
      .expect(201);

    const pedidoId = pedidoCreado.body.id;

    await request(app)
      .patch(`/api/pedidos/${pedidoId}/estado`)
      .set('Authorization', authHeader(tokenAdmin))
      .send({ estado: 'EN_PREPARACION' })
      .expect(200);

    const ingredienteLuegoPreparacion = await prisma.ingrediente.findUnique({ where: { id: ingrediente.id } });
    expect(Number(ingredienteLuegoPreparacion.stockActual)).toBe(8);

    const cancelado = await request(app)
      .post(`/api/pedidos/${pedidoId}/cancelar`)
      .set('Authorization', authHeader(tokenAdmin))
      .send({ motivo: 'Cliente se fue' })
      .expect(200);

    expect(cancelado.body.estado).toBe('CANCELADO');

    const mesaActualizada = await prisma.mesa.findUnique({ where: { id: mesa.id } });
    expect(mesaActualizada.estado).toBe('LIBRE');

    const ingredienteFinal = await prisma.ingrediente.findUnique({ where: { id: ingrediente.id } });
    expect(Number(ingredienteFinal.stockActual)).toBe(10);

    const movimientosEntrada = await prisma.movimientoStock.findMany({
      where: { tenantId: tenant.id, pedidoId, ingredienteId: ingrediente.id, tipo: 'ENTRADA' }
    });
    expect(movimientosEntrada.length).toBe(1);
    expect(Number(movimientosEntrada[0].cantidad)).toBe(2);
  });
});
