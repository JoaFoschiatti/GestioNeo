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

describe('Fichajes Endpoints', () => {
  let tenant;
  let token;
  let empleado;

  beforeAll(async () => {
    tenant = await createTenant();
    const admin = await createUsuario(tenant.id, {
      email: `${uniqueId('admin')}@example.com`,
      rol: 'ADMIN'
    });
    token = signTokenForUser(admin);

    empleado = await prisma.empleado.create({
      data: {
        tenantId: tenant.id,
        nombre: 'Empleado',
        apellido: 'Test',
        dni: `DNI-${uniqueId('fichaje')}`,
        rol: 'MOZO',
        tarifaHora: 1500,
        activo: true
      }
    });
  });

  afterAll(async () => {
    await cleanupTenantData(tenant.id);
    await prisma.$disconnect();
  });

  it('POST /api/fichajes/entrada crea fichaje y evita doble entrada', async () => {
    const creado = await request(app)
      .post('/api/fichajes/entrada')
      .set('Authorization', authHeader(token))
      .send({ empleadoId: empleado.id })
      .expect(201);

    expect(creado.body.id).toBeDefined();
    expect(creado.body.empleadoId).toBe(empleado.id);
    expect(creado.body.salida).toBe(null);
    expect(creado.body.empleado.nombre).toBe('Empleado');

    const duplicado = await request(app)
      .post('/api/fichajes/entrada')
      .set('Authorization', authHeader(token))
      .send({ empleadoId: empleado.id })
      .expect(400);

    expect(duplicado.body.error.message).toBe('El empleado ya tiene un fichaje de entrada sin salida');
  });

  it('POST /api/fichajes/salida cierra fichaje y evita salida sin entrada', async () => {
    const estadoAntes = await request(app)
      .get(`/api/fichajes/empleado/${empleado.id}/estado`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(estadoAntes.body.fichado).toBe(true);

    const salida = await request(app)
      .post('/api/fichajes/salida')
      .set('Authorization', authHeader(token))
      .send({ empleadoId: empleado.id })
      .expect(200);

    expect(salida.body.salida).toBeDefined();

    const estadoDespues = await request(app)
      .get(`/api/fichajes/empleado/${empleado.id}/estado`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(estadoDespues.body.fichado).toBe(false);

    const sinEntrada = await request(app)
      .post('/api/fichajes/salida')
      .set('Authorization', authHeader(token))
      .send({ empleadoId: empleado.id })
      .expect(400);

    expect(sinEntrada.body.error.message).toBe('No hay fichaje de entrada para registrar salida');
  });

  it('GET /api/fichajes/empleado/:empleadoId/horas calcula horas en período', async () => {
    // Crear un fichaje del día y fijar horas conocidas (2h 30m)
    const nuevo = await request(app)
      .post('/api/fichajes/entrada')
      .set('Authorization', authHeader(token))
      .send({ empleadoId: empleado.id })
      .expect(201);

    const inicio = new Date();
    inicio.setHours(10, 0, 0, 0);
    const fin = new Date();
    fin.setHours(12, 30, 0, 0);

    await request(app)
      .put(`/api/fichajes/${nuevo.body.id}`)
      .set('Authorization', authHeader(token))
      .send({ entrada: inicio.toISOString(), salida: fin.toISOString() })
      .expect(200);

    const now = new Date();
    const hoy = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const reporte = await request(app)
      .get(`/api/fichajes/empleado/${empleado.id}/horas?fechaDesde=${hoy}&fechaHasta=${hoy}`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(reporte.body.empleadoId).toBe(empleado.id);
    expect(reporte.body.totalFichajes).toBeGreaterThanOrEqual(1);
    expect(reporte.body.horasTotales).toBeGreaterThanOrEqual(2.5);
  });
});
