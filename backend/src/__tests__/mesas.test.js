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

describe('Mesas Endpoints', () => {
  let tokenAdmin;
  let tokenMozo;

  beforeAll(async () => {
    await cleanupTestData();
    await ensureActiveSuscripcion();
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
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it('POST /api/mesas crea mesa (ADMIN) y rechaza duplicados', async () => {
    const creada = await request(app)
      .post('/api/mesas')
      .set('Authorization', authHeader(tokenAdmin))
      .send({ numero: 1, zona: 'Salon', capacidad: 4 })
      .expect(201);

    expect(creada.body.id).toBeDefined();
    expect(creada.body.numero).toBe(1);
    expect(creada.body.estado).toBe('LIBRE');
    expect(creada.body.activa).toBe(true);

    const duplicada = await request(app)
      .post('/api/mesas')
      .set('Authorization', authHeader(tokenAdmin))
      .send({ numero: 1 })
      .expect(400);

    expect(duplicada.body.error.message).toBe('Ya existe una mesa con ese número');
  });

  it('POST /api/mesas rechaza creación si no es ADMIN', async () => {
    await request(app)
      .post('/api/mesas')
      .set('Authorization', authHeader(tokenMozo))
      .send({ numero: 2 })
      .expect(403);
  });

  it('GET /api/mesas lista mesas y filtra por estado/activa', async () => {
    await prisma.mesa.create({
      data: {
        numero: 10,
        capacidad: 4,
        estado: 'OCUPADA',
        activa: true
      }
    });

    const listado = await request(app)
      .get('/api/mesas')
      .set('Authorization', authHeader(tokenAdmin))
      .expect(200);

    const numeros = listado.body.map(m => m.numero);
    expect(numeros).toContain(1);
    expect(numeros).toContain(10);

    const ocupadas = await request(app)
      .get('/api/mesas?estado=OCUPADA')
      .set('Authorization', authHeader(tokenAdmin))
      .expect(200);

    expect(ocupadas.body.every(m => m.estado === 'OCUPADA')).toBe(true);
  });

  it('PATCH /api/mesas/:id/estado permite cambiar estado (MOZO)', async () => {
    const mesa = await prisma.mesa.create({
      data: {
        numero: 20,
        capacidad: 4,
        estado: 'LIBRE',
        activa: true
      }
    });

    const response = await request(app)
      .patch(`/api/mesas/${mesa.id}/estado`)
      .set('Authorization', authHeader(tokenMozo))
      .send({ estado: 'RESERVADA' })
      .expect(200);

    expect(response.body.id).toBe(mesa.id);
    expect(response.body.estado).toBe('RESERVADA');
  });

  it('DELETE /api/mesas/:id hace soft delete (activa=false) y permite filtrar activa=false', async () => {
    const mesa = await prisma.mesa.create({
      data: {
        numero: 30,
        capacidad: 4,
        estado: 'LIBRE',
        activa: true
      }
    });

    const response = await request(app)
      .delete(`/api/mesas/${mesa.id}`)
      .set('Authorization', authHeader(tokenAdmin))
      .expect(200);

    expect(response.body.message).toBe('Mesa desactivada correctamente');

    const inactivas = await request(app)
      .get('/api/mesas?activa=false')
      .set('Authorization', authHeader(tokenAdmin))
      .expect(200);

    const ids = inactivas.body.map(m => m.id);
    expect(ids).toContain(mesa.id);
  });

  // A2: Pedir cuenta
  it('POST /api/mesas/:id/pedir-cuenta cambia OCUPADA a CUENTA_PEDIDA', async () => {
    const mesa = await prisma.mesa.create({
      data: {
        numero: 40,
        capacidad: 4,
        estado: 'OCUPADA',
        activa: true
      }
    });

    await prisma.pedido.create({
      data: {
        tipo: 'MESA',
        mesaId: mesa.id,
        subtotal: 100,
        total: 100,
        estado: 'ENTREGADO'
      }
    });

    const response = await request(app)
      .post(`/api/mesas/${mesa.id}/pedir-cuenta`)
      .set('Authorization', authHeader(tokenMozo))
      .expect(200);

    expect(response.body.estado).toBe('CUENTA_PEDIDA');
  });

  it('POST /api/mesas/:id/pedir-cuenta rechaza mesa no OCUPADA', async () => {
    const mesa = await prisma.mesa.create({
      data: {
        numero: 41,
        capacidad: 4,
        estado: 'LIBRE',
        activa: true
      }
    });

    const response = await request(app)
      .post(`/api/mesas/${mesa.id}/pedir-cuenta`)
      .set('Authorization', authHeader(tokenMozo))
      .expect(400);

    expect(response.body.error.message).toBe('Solo se puede pedir la cuenta de una mesa ocupada');
  });

  it('POST /api/mesas/:id/pedir-cuenta rechaza mesa sin pedidos activos', async () => {
    const mesa = await prisma.mesa.create({
      data: {
        numero: 42,
        capacidad: 4,
        estado: 'OCUPADA',
        activa: true
      }
    });

    const response = await request(app)
      .post(`/api/mesas/${mesa.id}/pedir-cuenta`)
      .set('Authorization', authHeader(tokenMozo))
      .expect(400);

    expect(response.body.error.message).toBe('La mesa no tiene pedidos activos');
  });

  it('POST /api/mesas/:id/pedir-cuenta permite acceso a ADMIN', async () => {
    const mesa = await prisma.mesa.create({
      data: {
        numero: 43,
        capacidad: 4,
        estado: 'OCUPADA',
        activa: true
      }
    });

    await prisma.pedido.create({
      data: {
        tipo: 'MESA',
        mesaId: mesa.id,
        subtotal: 50,
        total: 50,
        estado: 'PENDIENTE'
      }
    });

    const response = await request(app)
      .post(`/api/mesas/${mesa.id}/pedir-cuenta`)
      .set('Authorization', authHeader(tokenAdmin))
      .expect(200);

    expect(response.body.estado).toBe('CUENTA_PEDIDA');
  });
});
