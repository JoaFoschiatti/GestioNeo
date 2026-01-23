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

describe('Cierres (Caja) Endpoints', () => {
  let tenant;
  let token;
  let usuario;

  beforeAll(async () => {
    tenant = await createTenant();
    usuario = await createUsuario(tenant.id, {
      email: `${uniqueId('admin')}@example.com`,
      rol: 'ADMIN'
    });
    token = signTokenForUser(usuario);
  });

  afterAll(async () => {
    await cleanupTenantData(tenant.id);
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
      where: { tenantId: tenant.id, estado: 'ABIERTO' },
      orderBy: { createdAt: 'desc' }
    });

    expect(cajaActual).toBeTruthy();

    const pedido = await prisma.pedido.create({
      data: {
        tenantId: tenant.id,
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
        { tenantId: tenant.id, pedidoId: pedido.id, monto: 500, metodo: 'EFECTIVO', estado: 'APROBADO', createdAt },
        { tenantId: tenant.id, pedidoId: pedido.id, monto: 200, metodo: 'TARJETA', estado: 'APROBADO', createdAt },
        { tenantId: tenant.id, pedidoId: pedido.id, monto: 300, metodo: 'MERCADOPAGO', estado: 'APROBADO', createdAt }
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
      where: { tenantId: tenant.id, estado: 'ABIERTO' },
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
});

