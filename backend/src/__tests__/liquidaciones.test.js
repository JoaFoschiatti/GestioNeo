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

describe('Liquidaciones Endpoints', () => {
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
        apellido: 'Liquidacion',
        dni: `DNI-${uniqueId('liq')}`,
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

  it('POST /api/liquidaciones/calcular calcula preview con fichajes', async () => {
    const fecha = new Date();
    fecha.setHours(0, 0, 0, 0);

    const entrada = new Date(fecha);
    entrada.setHours(10, 0, 0, 0);

    const salida = new Date(fecha);
    salida.setHours(12, 0, 0, 0);

    await prisma.fichaje.create({
      data: {
        tenantId: tenant.id,
        empleadoId: empleado.id,
        entrada,
        salida,
        fecha
      }
    });

    const hoy = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;

    const response = await request(app)
      .post('/api/liquidaciones/calcular')
      .set('Authorization', authHeader(token))
      .send({
        empleadoId: empleado.id,
        fechaDesde: hoy,
        fechaHasta: hoy
      })
      .expect(200);

    expect(response.body.empleado.id).toBe(empleado.id);
    expect(response.body.totalFichajes).toBeGreaterThanOrEqual(1);
    expect(response.body.horasTotales).toBeGreaterThanOrEqual(2);
    expect(response.body.subtotal).toBeGreaterThanOrEqual(3000);
  });

  it('POST /api/liquidaciones crea y GET /api/liquidaciones filtra por empleadoId/pagado', async () => {
    const hoy = new Date();
    const yyyymmdd = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

    const creado = await request(app)
      .post('/api/liquidaciones')
      .set('Authorization', authHeader(token))
      .send({
        empleadoId: empleado.id,
        periodoDesde: yyyymmdd,
        periodoHasta: yyyymmdd,
        horasTotales: 10,
        descuentos: 100,
        adicionales: 50,
        observaciones: 'Test'
      })
      .expect(201);

    expect(creado.body.id).toBeDefined();
    expect(creado.body.empleadoId).toBe(empleado.id);
    expect(creado.body.pagado).toBe(false);

    const listado = await request(app)
      .get(`/api/liquidaciones?empleadoId=${empleado.id}&pagado=false`)
      .set('Authorization', authHeader(token))
      .expect(200);

    const ids = listado.body.map(l => l.id);
    expect(ids).toContain(creado.body.id);
  });

  it('PATCH /api/liquidaciones/:id/pagar marca como pagada y DELETE lo rechaza', async () => {
    const hoy = new Date();
    const yyyymmdd = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

    const creado = await prisma.liquidacion.create({
      data: {
        tenantId: tenant.id,
        empleadoId: empleado.id,
        periodoDesde: new Date(yyyymmdd),
        periodoHasta: new Date(yyyymmdd),
        horasTotales: 5,
        tarifaHora: 1500,
        subtotal: 7500,
        descuentos: 0,
        adicionales: 0,
        totalPagar: 7500,
        pagado: false
      }
    });

    const pagada = await request(app)
      .patch(`/api/liquidaciones/${creado.id}/pagar`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(pagada.body.pagado).toBe(true);
    expect(pagada.body.fechaPago).toBeDefined();

    const eliminar = await request(app)
      .delete(`/api/liquidaciones/${creado.id}`)
      .set('Authorization', authHeader(token))
      .expect(400);

    expect(eliminar.body.error.message).toBe('No se puede eliminar una liquidación pagada');
  });

  it('DELETE /api/liquidaciones/:id elimina si no está pagada', async () => {
    const hoy = new Date();
    const yyyymmdd = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

    const creado = await request(app)
      .post('/api/liquidaciones')
      .set('Authorization', authHeader(token))
      .send({
        empleadoId: empleado.id,
        periodoDesde: yyyymmdd,
        periodoHasta: yyyymmdd,
        horasTotales: 2,
        descuentos: 0,
        adicionales: 0
      })
      .expect(201);

    const response = await request(app)
      .delete(`/api/liquidaciones/${creado.body.id}`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(response.body.message).toBe('Liquidación eliminada correctamente');
  });
});

