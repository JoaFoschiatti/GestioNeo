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

describe('Cierres (Caja) Endpoints', () => {
  let token;
  let usuario;

  beforeAll(async () => {
    await cleanupTestData();
    await ensureActiveSuscripcion();
    usuario = await createUsuario({
      email: `${uniqueId('admin')}@example.com`,
      rol: 'ADMIN'
    });
    token = signTokenForUser(usuario);
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it('GET /api/cierres/actual devuelve no hay caja abierta', async () => {
    const response = await request(app)
      .get('/api/cierres/actual')
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(response.body.cajaAbierta).toBe(false);
    expect(response.body.mensaje).toBe('No hay caja abierta');
  });

  it('POST /api/cierres abre caja y evita doble apertura', async () => {
    const creado = await request(app)
      .post('/api/cierres')
      .set('Authorization', authHeader(token))
      .send({ fondoInicial: 1000 })
      .expect(201);

    expect(creado.body.id).toBeDefined();
    expect(creado.body.estado).toBe('ABIERTO');
    expect(creado.body.usuarioId).toBe(usuario.id);

    const duplicado = await request(app)
      .post('/api/cierres')
      .set('Authorization', authHeader(token))
      .send({ fondoInicial: 500 })
      .expect(400);

    expect(duplicado.body.error.message).toBe('Ya existe una caja abierta. Debe cerrarla primero.');
  });

  it('GET /api/cierres/resumen incluye ventas aprobadas por metodo desde apertura', async () => {
    const cajaActual = await prisma.cierreCaja.findFirst({
      where: { estado: 'ABIERTO' },
      orderBy: { createdAt: 'desc' }
    });

    expect(cajaActual).toBeTruthy();

    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: 1000,
        total: 1000,
        usuarioId: usuario.id
      }
    });

    const createdAt = new Date(cajaActual.horaApertura);
    createdAt.setSeconds(createdAt.getSeconds() + 1);

    await prisma.pago.createMany({
      data: [
        { pedidoId: pedido.id, monto: 500, metodo: 'EFECTIVO', estado: 'APROBADO', createdAt },
        { pedidoId: pedido.id, monto: 200, metodo: 'TARJETA', estado: 'APROBADO', createdAt },
        { pedidoId: pedido.id, monto: 300, metodo: 'MERCADOPAGO', estado: 'APROBADO', createdAt }
      ]
    });

    const response = await request(app)
      .get('/api/cierres/resumen')
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(response.body.ventasEfectivo).toBeGreaterThanOrEqual(500);
    expect(response.body.ventasTarjeta).toBeGreaterThanOrEqual(200);
    expect(response.body.ventasMercadoPago).toBeGreaterThanOrEqual(300);
    expect(response.body.totalVentas).toBeGreaterThanOrEqual(1000);
    expect(response.body.efectivoEsperado).toBeGreaterThanOrEqual(1500);
  });

  it('PATCH /api/cierres/:id/cerrar cierra caja y deja resumen con diferencia', async () => {
    const cajaActual = await prisma.cierreCaja.findFirst({
      where: { estado: 'ABIERTO' },
      orderBy: { createdAt: 'desc' }
    });

    const response = await request(app)
      .patch(`/api/cierres/${cajaActual.id}/cerrar`)
      .set('Authorization', authHeader(token))
      .send({ efectivoFisico: 1600, observaciones: 'Cierre test' })
      .expect(200);

    expect(response.body.caja.estado).toBe('CERRADO');
    expect(response.body.caja.horaCierre).toBeDefined();
    expect(response.body.resumen.efectivoContado).toBe(1600);
    expect(response.body.resumen.diferencia).toBeDefined();
  });

  it('GET /api/cierres lista cierres', async () => {
    const response = await request(app)
      .get('/api/cierres?limit=5')
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThanOrEqual(1);
    expect(response.body[0].estado).toBe('CERRADO');
  });

  // A1: Propinas en resumen y reparto al cerrar
  it('GET /api/cierres/resumen incluye ventasPropinas', async () => {
    // Abrir nueva caja
    const abierta = await request(app)
      .post('/api/cierres')
      .set('Authorization', authHeader(token))
      .send({ fondoInicial: 500 })
      .expect(201);

    const cajaId = abierta.body.id;

    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: 200,
        total: 200
      }
    });

    await prisma.pago.create({
      data: {
        pedidoId: pedido.id,
        monto: 200,
        metodo: 'EFECTIVO',
        estado: 'APROBADO',
        propina: 30
      }
    });

    const response = await request(app)
      .get('/api/cierres/resumen')
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(response.body.ventasPropinas).toBeGreaterThanOrEqual(30);
    expect(response.body.propinas).toBeDefined();
    expect(response.body.propinas.total).toBeGreaterThanOrEqual(30);

    // Cerrar para permitir siguientes tests
    await request(app)
      .patch(`/api/cierres/${cajaId}/cerrar`)
      .set('Authorization', authHeader(token))
      .send({ efectivoFisico: 700 })
      .expect(200);
  });

  it('PATCH /api/cierres/:id/cerrar crea RepartoPropina entre mozos fichados', async () => {
    // Clean up previous fichajes and empleados to avoid leakage
    await prisma.repartoPropina.deleteMany({});
    await prisma.fichaje.deleteMany({});
    await prisma.empleado.deleteMany({});

    // Crear empleados MOZO con fichaje
    const empleado1 = await prisma.empleado.create({
      data: {
        nombre: 'Juan',
        apellido: 'Mozo1',
        dni: uniqueId('dni1'),
        rol: 'MOZO',
        tarifaHora: 100,
        activo: true
      }
    });

    const empleado2 = await prisma.empleado.create({
      data: {
        nombre: 'Pedro',
        apellido: 'Mozo2',
        dni: uniqueId('dni2'),
        rol: 'MOZO',
        tarifaHora: 100,
        activo: true
      }
    });

    // Abrir caja
    const abierta = await request(app)
      .post('/api/cierres')
      .set('Authorization', authHeader(token))
      .send({ fondoInicial: 500 })
      .expect(201);

    const cajaId = abierta.body.id;
    const caja = await prisma.cierreCaja.findUnique({ where: { id: cajaId } });

    // Crear fichajes para los mozos (entrada = horaApertura, so it counts)
    await prisma.fichaje.createMany({
      data: [
        { empleadoId: empleado1.id, entrada: caja.horaApertura, fecha: caja.horaApertura },
        { empleadoId: empleado2.id, entrada: caja.horaApertura, fecha: caja.horaApertura }
      ]
    });

    // Crear pago con propina
    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: 300,
        total: 300
      }
    });

    await prisma.pago.create({
      data: {
        pedidoId: pedido.id,
        monto: 300,
        metodo: 'EFECTIVO',
        estado: 'APROBADO',
        propina: 100
      }
    });

    // Cerrar caja
    const cierre = await request(app)
      .patch(`/api/cierres/${cajaId}/cerrar`)
      .set('Authorization', authHeader(token))
      .send({ efectivoFisico: 800 })
      .expect(200);

    expect(cierre.body.resumen.totalPropinas).toBeGreaterThanOrEqual(100);
    expect(cierre.body.resumen.repartoPropinas).toBeDefined();
    expect(cierre.body.resumen.repartoPropinas.length).toBe(2);

    // Sum of montos equals totalPropinas
    const montos = cierre.body.resumen.repartoPropinas.map(r => Number(r.monto));
    const sumaReparto = montos.reduce((a, b) => a + b, 0);
    expect(sumaReparto).toBe(cierre.body.resumen.totalPropinas);

    // Verificar en DB
    const repartoDb = await prisma.repartoPropina.findMany({
      where: { cierreId: cajaId }
    });
    expect(repartoDb.length).toBe(2);
  });

  it('Cierre sin propinas no crea RepartoPropina', async () => {
    // Clean up fichajes/empleados to prevent mozos from leaking in
    await prisma.repartoPropina.deleteMany({});
    await prisma.fichaje.deleteMany({});
    await prisma.empleado.deleteMany({});

    // Abrir caja
    const abierta = await request(app)
      .post('/api/cierres')
      .set('Authorization', authHeader(token))
      .send({ fondoInicial: 200 })
      .expect(201);

    const cajaId = abierta.body.id;

    // Crear pago sin propina
    const pedido = await prisma.pedido.create({
      data: {
        tipo: 'MOSTRADOR',
        subtotal: 100,
        total: 100
      }
    });

    await prisma.pago.create({
      data: {
        pedidoId: pedido.id,
        monto: 100,
        metodo: 'EFECTIVO',
        estado: 'APROBADO'
      }
    });

    const cierre = await request(app)
      .patch(`/api/cierres/${cajaId}/cerrar`)
      .set('Authorization', authHeader(token))
      .send({ efectivoFisico: 300 })
      .expect(200);

    const repartoDb = await prisma.repartoPropina.findMany({
      where: { cierreId: cajaId }
    });
    expect(repartoDb).toEqual([]);
  });
});
