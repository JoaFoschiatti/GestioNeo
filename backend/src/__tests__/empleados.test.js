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

describe('Empleados Endpoints', () => {
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

  it('GET /api/empleados lista empleados', async () => {
    const response = await request(app)
      .get('/api/empleados')
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it('POST /api/empleados crea empleado y rechaza DNI duplicado', async () => {
    const payload = {
      nombre: 'Juan',
      apellido: 'Perez',
      dni: `DNI-${uniqueId('dni')}`,
      rol: 'MOZO',
      tarifaHora: 1500
    };

    const creado = await request(app)
      .post('/api/empleados')
      .set('Authorization', authHeader(token))
      .send(payload)
      .expect(201);

    expect(creado.body.id).toBeDefined();
    expect(creado.body.dni).toBe(payload.dni);
    expect(creado.body.activo).toBe(true);

    const duplicado = await request(app)
      .post('/api/empleados')
      .set('Authorization', authHeader(token))
      .send({ ...payload, nombre: 'Otro' })
      .expect(400);

    expect(duplicado.body.error.message).toBe('Ya existe un empleado con ese DNI');
  });

  it('PUT /api/empleados/:id actualiza empleado', async () => {
    const empleado = await prisma.empleado.create({
      data: {
        nombre: 'Maria',
        apellido: 'Garcia',
        dni: `DNI-${uniqueId('upd')}`,
        rol: 'CAJERO',
        tarifaHora: 1600,
        activo: true
      }
    });

    const response = await request(app)
      .put(`/api/empleados/${empleado.id}`)
      .set('Authorization', authHeader(token))
      .send({ telefono: '3411234567', tarifaHora: 1700 })
      .expect(200);

    expect(response.body.id).toBe(empleado.id);
    expect(response.body.telefono).toBe('3411234567');
    expect(Number(response.body.tarifaHora)).toBe(1700);
  });

  it('DELETE /api/empleados/:id hace soft delete y permite filtrar activo=false', async () => {
    const empleado = await prisma.empleado.create({
      data: {
        nombre: 'Pedro',
        apellido: 'Lopez',
        dni: `DNI-${uniqueId('del')}`,
        rol: 'DELIVERY',
        tarifaHora: 1400,
        activo: true
      }
    });

    const response = await request(app)
      .delete(`/api/empleados/${empleado.id}`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(response.body.message).toBe('Empleado desactivado correctamente');

    const listado = await request(app)
      .get('/api/empleados?activo=false')
      .set('Authorization', authHeader(token))
      .expect(200);

    const ids = listado.body.map(e => e.id);
    expect(ids).toContain(empleado.id);
  });
});
