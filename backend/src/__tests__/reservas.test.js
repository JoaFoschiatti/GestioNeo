const request = require('supertest');
const app = require('../app');
const { procesarReservas } = require('../jobs/reservas.job');
const {
  prisma,
  uniqueId,
  createTenant,
  createUsuario,
  signTokenForUser,
  authHeader,
  cleanupTenantData
} = require('./helpers/test-helpers');

describe('Reservas Endpoints', () => {
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

  it('POST /api/reservas crea una reserva (ADMIN) y GET /api/reservas/:id la devuelve', async () => {
    const mesa = await prisma.mesa.create({
      data: { tenantId: tenant.id, numero: 10, capacidad: 4, estado: 'LIBRE', activa: true }
    });

    const fechaHora = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const creada = await request(app)
      .post('/api/reservas')
      .set('Authorization', authHeader(tokenAdmin))
      .send({
        mesaId: mesa.id,
        clienteNombre: 'Cliente Test',
        clienteTelefono: '3410000000',
        fechaHora,
        cantidadPersonas: 3,
        observaciones: 'Mesa cerca de la ventana'
      })
      .expect(201);

    expect(creada.body.id).toBeDefined();
    expect(creada.body.mesaId).toBe(mesa.id);
    expect(creada.body.estado).toBe('CONFIRMADA');

    const obtenida = await request(app)
      .get(`/api/reservas/${creada.body.id}`)
      .set('Authorization', authHeader(tokenAdmin))
      .expect(200);

    expect(obtenida.body.id).toBe(creada.body.id);
    expect(obtenida.body.mesa.numero).toBe(10);
  });

  it('POST /api/reservas rechaza si no es ADMIN', async () => {
    const mesa = await prisma.mesa.create({
      data: { tenantId: tenant.id, numero: 11, capacidad: 4, estado: 'LIBRE', activa: true }
    });

    const response = await request(app)
      .post('/api/reservas')
      .set('Authorization', authHeader(tokenMozo))
      .send({
        mesaId: mesa.id,
        clienteNombre: 'Cliente Test',
        fechaHora: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        cantidadPersonas: 2
      })
      .expect(403);

    expect(response.body.error.message).toBe('No tienes permisos para realizar esta acción');
  });

  it('POST /api/reservas valida capacidad de mesa', async () => {
    const mesa = await prisma.mesa.create({
      data: { tenantId: tenant.id, numero: 12, capacidad: 2, estado: 'LIBRE', activa: true }
    });

    const response = await request(app)
      .post('/api/reservas')
      .set('Authorization', authHeader(tokenAdmin))
      .send({
        mesaId: mesa.id,
        clienteNombre: 'Cliente Test',
        fechaHora: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        cantidadPersonas: 3
      })
      .expect(400);

    expect(response.body.error.message).toMatch(/capacidad/);
  });

  it('POST /api/reservas evita conflicto de reserva cercana (±2h)', async () => {
    const mesa = await prisma.mesa.create({
      data: { tenantId: tenant.id, numero: 13, capacidad: 4, estado: 'LIBRE', activa: true }
    });

    const base = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await request(app)
      .post('/api/reservas')
      .set('Authorization', authHeader(tokenAdmin))
      .send({
        mesaId: mesa.id,
        clienteNombre: 'Cliente 1',
        fechaHora: base.toISOString(),
        cantidadPersonas: 2
      })
      .expect(201);

    const response = await request(app)
      .post('/api/reservas')
      .set('Authorization', authHeader(tokenAdmin))
      .send({
        mesaId: mesa.id,
        clienteNombre: 'Cliente 2',
        fechaHora: new Date(base.getTime() + 60 * 60 * 1000).toISOString(),
        cantidadPersonas: 2
      })
      .expect(400);

    expect(response.body.error.message).toMatch(/Ya existe una reserva/);
  });

  it('PUT /api/reservas/:id solo permite modificar reservas CONFIRMADAS', async () => {
    const mesa = await prisma.mesa.create({
      data: { tenantId: tenant.id, numero: 14, capacidad: 4, estado: 'LIBRE', activa: true }
    });

    const creada = await request(app)
      .post('/api/reservas')
      .set('Authorization', authHeader(tokenAdmin))
      .send({
        mesaId: mesa.id,
        clienteNombre: 'Cliente Test',
        fechaHora: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        cantidadPersonas: 2
      })
      .expect(201);

    await request(app)
      .patch(`/api/reservas/${creada.body.id}/estado`)
      .set('Authorization', authHeader(tokenAdmin))
      .send({ estado: 'NO_LLEGO' })
      .expect(200);

    const response = await request(app)
      .put(`/api/reservas/${creada.body.id}`)
      .set('Authorization', authHeader(tokenAdmin))
      .send({ observaciones: 'Cambio no permitido' })
      .expect(400);

    expect(response.body.error.message).toBe('Solo se pueden modificar reservas confirmadas');
  });

  it('PATCH /api/reservas/:id/estado actualiza mesa si está RESERVADA', async () => {
    const mesa = await prisma.mesa.create({
      data: { tenantId: tenant.id, numero: 15, capacidad: 4, estado: 'RESERVADA', activa: true }
    });

    const creada = await request(app)
      .post('/api/reservas')
      .set('Authorization', authHeader(tokenAdmin))
      .send({
        mesaId: mesa.id,
        clienteNombre: 'Cliente Test',
        fechaHora: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        cantidadPersonas: 2
      })
      .expect(201);

    await request(app)
      .patch(`/api/reservas/${creada.body.id}/estado`)
      .set('Authorization', authHeader(tokenAdmin))
      .send({ estado: 'CLIENTE_PRESENTE' })
      .expect(200);

    const mesaActualizada = await prisma.mesa.findUnique({ where: { id: mesa.id } });
    expect(mesaActualizada.estado).toBe('OCUPADA');

    const mesa2 = await prisma.mesa.create({
      data: { tenantId: tenant.id, numero: 16, capacidad: 4, estado: 'RESERVADA', activa: true }
    });

    const creada2 = await request(app)
      .post('/api/reservas')
      .set('Authorization', authHeader(tokenAdmin))
      .send({
        mesaId: mesa2.id,
        clienteNombre: 'Cliente Test',
        fechaHora: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        cantidadPersonas: 2
      })
      .expect(201);

    await request(app)
      .patch(`/api/reservas/${creada2.body.id}/estado`)
      .set('Authorization', authHeader(tokenAdmin))
      .send({ estado: 'CANCELADA' })
      .expect(200);

    const mesaLiberada = await prisma.mesa.findUnique({ where: { id: mesa2.id } });
    expect(mesaLiberada.estado).toBe('LIBRE');
  });

  it('DELETE /api/reservas/:id libera mesa si estaba RESERVADA', async () => {
    const mesa = await prisma.mesa.create({
      data: { tenantId: tenant.id, numero: 17, capacidad: 4, estado: 'RESERVADA', activa: true }
    });

    const creada = await request(app)
      .post('/api/reservas')
      .set('Authorization', authHeader(tokenAdmin))
      .send({
        mesaId: mesa.id,
        clienteNombre: 'Cliente Test',
        fechaHora: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        cantidadPersonas: 2
      })
      .expect(201);

    const response = await request(app)
      .delete(`/api/reservas/${creada.body.id}`)
      .set('Authorization', authHeader(tokenAdmin))
      .expect(200);

    expect(response.body.message).toBe('Reserva eliminada');

    const mesaActualizada = await prisma.mesa.findUnique({ where: { id: mesa.id } });
    expect(mesaActualizada.estado).toBe('LIBRE');
  });

  it('GET /api/reservas/proximas devuelve reservas confirmadas en los próximos 30 min', async () => {
    const mesa = await prisma.mesa.create({
      data: { tenantId: tenant.id, numero: 18, capacidad: 4, estado: 'LIBRE', activa: true }
    });

    const fechaHora = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const reserva = await request(app)
      .post('/api/reservas')
      .set('Authorization', authHeader(tokenAdmin))
      .send({
        mesaId: mesa.id,
        clienteNombre: 'Cliente Test',
        fechaHora,
        cantidadPersonas: 2
      })
      .expect(201);

    const response = await request(app)
      .get('/api/reservas/proximas')
      .set('Authorization', authHeader(tokenMozo))
      .expect(200);

    const ids = response.body.map(r => r.id);
    expect(ids).toContain(reserva.body.id);
  });

  it('Job reservas: marca mesa RESERVADA 15 min antes y NO_LLEGO luego de 30 min', async () => {
    const mesa = await prisma.mesa.create({
      data: { tenantId: tenant.id, numero: 19, capacidad: 4, estado: 'LIBRE', activa: true }
    });

    await prisma.reserva.create({
      data: {
        tenantId: tenant.id,
        mesaId: mesa.id,
        clienteNombre: 'Cliente Job',
        fechaHora: new Date(Date.now() + 10 * 60 * 1000),
        cantidadPersonas: 2,
        estado: 'CONFIRMADA'
      }
    });

    await procesarReservas();

    const mesaReservada = await prisma.mesa.findUnique({ where: { id: mesa.id } });
    expect(mesaReservada.estado).toBe('RESERVADA');

    const mesa2 = await prisma.mesa.create({
      data: { tenantId: tenant.id, numero: 20, capacidad: 4, estado: 'RESERVADA', activa: true }
    });

    const reservaVencida = await prisma.reserva.create({
      data: {
        tenantId: tenant.id,
        mesaId: mesa2.id,
        clienteNombre: 'Cliente Job 2',
        fechaHora: new Date(Date.now() - 31 * 60 * 1000),
        cantidadPersonas: 2,
        estado: 'CONFIRMADA'
      }
    });

    await procesarReservas();

    const reservaActualizada = await prisma.reserva.findUnique({ where: { id: reservaVencida.id } });
    expect(reservaActualizada.estado).toBe('NO_LLEGO');

    const mesaLiberada = await prisma.mesa.findUnique({ where: { id: mesa2.id } });
    expect(mesaLiberada.estado).toBe('LIBRE');
  });
});

