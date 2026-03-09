const request = require('supertest');
const app = require('../app');
const {
  prisma,
  uniqueId,
    createUsuario,
  signTokenForUser,
  authHeader,
  cleanupOperationalData,
  ensureNegocio
} = require('./helpers/test-helpers');

describe('Pedidos Endpoints', () => {
    let tokenAdmin;
  let tokenMozo;

  beforeAll(async () => {
        await cleanupOperationalData();
    await ensureNegocio();
    const admin = await createUsuario({
      email: `${uniqueId('admin')}@example.com`,
      rol: 'ADMIN'
    });
    tokenAdmin = signTokenForUser(admin);

    const mozo = await createUsuario({
      email: `${uniqueId('mozo')}@example.com`,
      rol: 'MOZO'
    });
    tokenMozo = signTokenForUser(mozo);
  });

  afterAll(async () => {
    await cleanupOperationalData();
  });

  it('POST /api/pedidos crea pedido MESA, aplica modificadores y ocupa mesa', async () => {
    const mesa = await prisma.mesa.create({
      data: {
        numero: 1,
        capacidad: 4,
        estado: 'LIBRE',
        activa: true
      }
    });

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

    const modificador = await prisma.modificador.create({
      data: {
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
      data: { nombre: `Cat-${uniqueId('cat2')}`, orden: 1, activa: true }
    });

    const ingrediente = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('ing')}`,
        unidad: 'u',
        stockActual: 10,
        stockMinimo: 0,
        activo: true
      }
    });

    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('prod2')}`,
        precio: 5,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    await prisma.productoIngrediente.create({
      data: {
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
      where: { pedidoId, ingredienteId: ingrediente.id, tipo: 'SALIDA' }
    });
    expect(movimientosSalida.length).toBe(1);
    expect(Number(movimientosSalida[0].cantidad)).toBe(4);

    const jobs = await prisma.printJob.findMany({
      where: { pedidoId }
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

    const ids = listado.body.data.map(p => p.id);
    expect(ids).toContain(pedidoId);
  });

  it('POST /api/pedidos/:id/cancelar restaura stock y libera mesa si ya estaba en preparación', async () => {
    const mesa = await prisma.mesa.create({
      data: {
        numero: 50,
        capacidad: 4,
        estado: 'LIBRE',
        activa: true
      }
    });

    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('cat3')}`, orden: 1, activa: true }
    });

    const ingrediente = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('ing2')}`,
        unidad: 'u',
        stockActual: 10,
        stockMinimo: 0,
        activo: true
      }
    });

    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('prod3')}`,
        precio: 5,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    await prisma.productoIngrediente.create({
      data: {
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
      where: { pedidoId, ingredienteId: ingrediente.id, tipo: 'ENTRADA' }
    });
    expect(movimientosEntrada.length).toBe(1);
    expect(Number(movimientosEntrada[0].cantidad)).toBe(2);
  });
  it('PATCH /api/pedidos/:id/estado descuenta stock por lotes usando FIFO', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('catfifo')}`, orden: 1, activa: true }
    });

    const ingrediente = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('fifo')}`,
        unidad: 'u',
        stockActual: 10,
        stockMinimo: 0,
        activo: true
      }
    });

    const loteViejo = await prisma.loteStock.create({
      data: {
        ingredienteId: ingrediente.id,
        codigoLote: `LOT-${uniqueId('old')}`,
        stockInicial: 3,
        stockActual: 3,
        fechaIngreso: new Date('2026-01-10T10:00:00.000Z')
      }
    });

    const loteNuevo = await prisma.loteStock.create({
      data: {
        ingredienteId: ingrediente.id,
        codigoLote: `LOT-${uniqueId('new')}`,
        stockInicial: 7,
        stockActual: 7,
        fechaIngreso: new Date('2026-02-10T10:00:00.000Z')
      }
    });

    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('prodfifo')}`,
        precio: 8,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    await prisma.productoIngrediente.create({
      data: {
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

    await request(app)
      .patch(`/api/pedidos/${pedidoId}/estado`)
      .set('Authorization', authHeader(tokenAdmin))
      .send({ estado: 'EN_PREPARACION' })
      .expect(200);

    const lotes = await prisma.loteStock.findMany({
      where: { ingredienteId: ingrediente.id },
      orderBy: { fechaIngreso: 'asc' }
    });

    expect(Number(lotes[0].stockActual)).toBe(0);
    expect(lotes[0].activo).toBe(false);
    expect(Number(lotes[1].stockActual)).toBe(6);

    const movimientosSalida = await prisma.movimientoStock.findMany({
      where: { pedidoId, ingredienteId: ingrediente.id, tipo: 'SALIDA' },
      orderBy: { createdAt: 'asc' }
    });

    expect(movimientosSalida).toHaveLength(2);
    expect(Number(movimientosSalida[0].cantidad)).toBe(3);
    expect(movimientosSalida[0].loteStockId).toBe(loteViejo.id);
    expect(Number(movimientosSalida[1].cantidad)).toBe(1);
    expect(movimientosSalida[1].loteStockId).toBe(loteNuevo.id);
  });

  it('POST /api/pedidos/:id/cancelar repone stock sobre el mismo lote consumido', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('catcancel')}`, orden: 1, activa: true }
    });

    const ingrediente = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('lotecancel')}`,
        unidad: 'u',
        stockActual: 5,
        stockMinimo: 0,
        activo: true
      }
    });

    const lote = await prisma.loteStock.create({
      data: {
        ingredienteId: ingrediente.id,
        codigoLote: `LOT-${uniqueId('cancel')}`,
        stockInicial: 5,
        stockActual: 5,
        fechaIngreso: new Date('2026-01-15T10:00:00.000Z')
      }
    });

    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('cancel')}`,
        precio: 5,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    await prisma.productoIngrediente.create({
      data: {
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
          { productoId: producto.id, cantidad: 1 }
        ]
      })
      .expect(201);

    const pedidoId = pedidoCreado.body.id;

    await request(app)
      .patch(`/api/pedidos/${pedidoId}/estado`)
      .set('Authorization', authHeader(tokenAdmin))
      .send({ estado: 'EN_PREPARACION' })
      .expect(200);

    await request(app)
      .post(`/api/pedidos/${pedidoId}/cancelar`)
      .set('Authorization', authHeader(tokenAdmin))
      .send({ motivo: 'Prueba lote' })
      .expect(200);

    const movimientos = await prisma.movimientoStock.findMany({
      where: { pedidoId, ingredienteId: ingrediente.id },
      orderBy: { createdAt: 'asc' }
    });

    expect(movimientos).toHaveLength(2);
    expect(movimientos[0].tipo).toBe('SALIDA');
    expect(movimientos[0].loteStockId).toBe(lote.id);
    expect(movimientos[1].tipo).toBe('ENTRADA');
    expect(movimientos[1].loteStockId).toBe(lote.id);

    const loteActualizado = await prisma.loteStock.findUnique({ where: { id: lote.id } });
    expect(Number(loteActualizado.stockActual)).toBe(5);
  });

  it('PATCH /api/pedidos/:id/estado usa el lote vigente mas antiguo cuando hay lotes vencidos', async () => {
    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat-${uniqueId('catexp')}`, orden: 1, activa: true }
    });

    const ingrediente = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('expfifo')}`,
        unidad: 'u',
        stockActual: 5,
        stockMinimo: 0,
        activo: true
      }
    });

    const loteVencido = await prisma.loteStock.create({
      data: {
        ingredienteId: ingrediente.id,
        codigoLote: `LOT-${uniqueId('exp')}`,
        stockInicial: 2,
        stockActual: 2,
        fechaIngreso: new Date('2026-01-01T10:00:00.000Z'),
        fechaVencimiento: new Date('2026-02-01T23:59:59.999Z')
      }
    });

    const loteVigente = await prisma.loteStock.create({
      data: {
        ingredienteId: ingrediente.id,
        codigoLote: `LOT-${uniqueId('vig')}`,
        stockInicial: 3,
        stockActual: 3,
        fechaIngreso: new Date('2026-02-15T10:00:00.000Z')
      }
    });

    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod-${uniqueId('expfifo')}`,
        precio: 9,
        categoriaId: categoria.id,
        disponible: true
      }
    });

    await prisma.productoIngrediente.create({
      data: {
        productoId: producto.id,
        ingredienteId: ingrediente.id,
        cantidad: 3
      }
    });

    const pedidoCreado = await request(app)
      .post('/api/pedidos')
      .set('Authorization', authHeader(tokenAdmin))
      .send({
        tipo: 'MOSTRADOR',
        items: [
          { productoId: producto.id, cantidad: 1 }
        ]
      })
      .expect(201);

    const pedidoId = pedidoCreado.body.id;

    await request(app)
      .patch(`/api/pedidos/${pedidoId}/estado`)
      .set('Authorization', authHeader(tokenAdmin))
      .send({ estado: 'EN_PREPARACION' })
      .expect(200);

    const lotes = await prisma.loteStock.findMany({
      where: { ingredienteId: ingrediente.id },
      orderBy: { fechaIngreso: 'asc' }
    });

    expect(Number(lotes.find((item) => item.id === loteVencido.id).stockActual)).toBe(2);
    expect(Number(lotes.find((item) => item.id === loteVigente.id).stockActual)).toBe(0);

    const movimientosSalida = await prisma.movimientoStock.findMany({
      where: { pedidoId, ingredienteId: ingrediente.id, tipo: 'SALIDA' }
    });

    expect(movimientosSalida).toHaveLength(1);
    expect(Number(movimientosSalida[0].cantidad)).toBe(3);
    expect(movimientosSalida[0].loteStockId).toBe(loteVigente.id);
  });
});
