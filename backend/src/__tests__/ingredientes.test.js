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

describe('Ingredientes Endpoints', () => {
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
        nombre: `Ing-${uniqueId('bajo')}`,
        unidad: 'kg',
        stockActual: 1,
        stockMinimo: 2,
        activo: true
      }
    });

    await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('ok')}`,
        unidad: 'kg',
        stockActual: 10,
        stockMinimo: 2,
        activo: true
      }
    });

    await prisma.ingrediente.create({
      data: {
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

  // B3: Gastos por categoria — movimiento ENTRADA con costoUnitario y categoriaGasto
  it('POST /api/ingredientes/:id/movimiento ENTRADA guarda categoriaGasto y costoTotal', async () => {
    const ingrediente = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('gasto')}`,
        unidad: 'kg',
        stockActual: 0,
        stockMinimo: 0,
        activo: true
      }
    });

    await request(app)
      .post(`/api/ingredientes/${ingrediente.id}/movimiento`)
      .set('Authorization', authHeader(token))
      .send({
        tipo: 'ENTRADA',
        cantidad: 5,
        motivo: 'Compra semanal',
        categoriaGasto: 'Carnes',
        costoUnitario: 100
      })
      .expect(200);

    const movimiento = await prisma.movimientoStock.findFirst({
      where: { ingredienteId: ingrediente.id, tipo: 'ENTRADA' },
      orderBy: { createdAt: 'desc' }
    });

    expect(movimiento.categoriaGasto).toBe('Carnes');
    expect(Number(movimiento.costoUnitario)).toBe(100);
    expect(Number(movimiento.costoTotal)).toBe(500);
  });

  // B1: Control de lotes
  it('POST /api/ingredientes/:id/lotes crea lote e incrementa stock', async () => {
    const ingrediente = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('lote1')}`,
        unidad: 'kg',
        stockActual: 0,
        stockMinimo: 0,
        activo: true
      }
    });

    const response = await request(app)
      .post(`/api/ingredientes/${ingrediente.id}/lotes`)
      .set('Authorization', authHeader(token))
      .send({
        cantidad: 10,
        codigoLote: 'LOT-001',
        costoUnitario: 50,
        fechaVencimiento: '2027-06-01',
        categoriaGasto: 'Lacteos'
      })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(Number(response.body.cantidadInicial)).toBe(10);
    expect(Number(response.body.cantidadActual)).toBe(10);
    expect(response.body.codigoLote).toBe('LOT-001');

    const ingDb = await prisma.ingrediente.findUnique({ where: { id: ingrediente.id } });
    expect(Number(ingDb.stockActual)).toBe(10);
  });

  it('GET /api/ingredientes/:id/lotes lista lotes del ingrediente', async () => {
    const ingrediente = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('lote2')}`,
        unidad: 'u',
        stockActual: 15,
        stockMinimo: 0,
        activo: true
      }
    });

    await prisma.loteIngrediente.createMany({
      data: [
        { ingredienteId: ingrediente.id, cantidadInicial: 5, cantidadActual: 5, codigoLote: 'A' },
        { ingredienteId: ingrediente.id, cantidadInicial: 10, cantidadActual: 10, codigoLote: 'B' }
      ]
    });

    const response = await request(app)
      .get(`/api/ingredientes/${ingrediente.id}/lotes`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(2);
  });

  it('GET /api/ingredientes/lotes/alertas-vencimiento devuelve lotes proximos a vencer', async () => {
    const ingrediente = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('venc')}`,
        unidad: 'u',
        stockActual: 15,
        stockMinimo: 0,
        activo: true
      }
    });

    const manana = new Date();
    manana.setDate(manana.getDate() + 1);

    const en30dias = new Date();
    en30dias.setDate(en30dias.getDate() + 30);

    await prisma.loteIngrediente.create({
      data: {
        ingredienteId: ingrediente.id,
        cantidadInicial: 5,
        cantidadActual: 5,
        fechaVencimiento: manana,
        codigoLote: 'PROX-VENCER'
      }
    });

    await prisma.loteIngrediente.create({
      data: {
        ingredienteId: ingrediente.id,
        cantidadInicial: 10,
        cantidadActual: 10,
        fechaVencimiento: en30dias,
        codigoLote: 'LEJANO'
      }
    });

    const response = await request(app)
      .get('/api/ingredientes/lotes/alertas-vencimiento?dias=7')
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    const codigos = response.body.map(l => l.codigoLote);
    expect(codigos).toContain('PROX-VENCER');
    expect(codigos).not.toContain('LEJANO');
  });

  it('POST /api/ingredientes/lotes/:loteId/descartar marca lote agotado y decrementa stock', async () => {
    const ingrediente = await prisma.ingrediente.create({
      data: {
        nombre: `Ing-${uniqueId('desc')}`,
        unidad: 'u',
        stockActual: 5,
        stockMinimo: 0,
        activo: true
      }
    });

    const lote = await prisma.loteIngrediente.create({
      data: {
        ingredienteId: ingrediente.id,
        cantidadInicial: 5,
        cantidadActual: 5,
        codigoLote: 'DESCARTAR'
      }
    });

    const response = await request(app)
      .post(`/api/ingredientes/lotes/${lote.id}/descartar`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(response.body.descartado).toBe(true);
    expect(response.body.cantidad).toBe(5);

    const loteDb = await prisma.loteIngrediente.findUnique({ where: { id: lote.id } });
    expect(loteDb.agotado).toBe(true);
    expect(Number(loteDb.cantidadActual)).toBe(0);

    const ingDb = await prisma.ingrediente.findUnique({ where: { id: ingrediente.id } });
    expect(Number(ingDb.stockActual)).toBe(0);
  });
});
