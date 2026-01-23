const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../app');
const {
  prisma,
  uniqueId,
  createTenant,
  signTokenForUser,
  authHeader,
  cleanupTenantData
} = require('./helpers/test-helpers');

describe('SuperAdmin Endpoints', () => {
  let token;
  let superadmin;
  let tenantActivo;
  let tenantInactivo;

  beforeAll(async () => {
    tenantActivo = await createTenant({ nombre: 'Tenant Activo', activo: true });
    tenantInactivo = await createTenant({ nombre: 'Tenant Inactivo', activo: false });

    const passwordHash = await bcrypt.hash('password', 4);
    superadmin = await prisma.usuario.create({
      data: {
        tenantId: null,
        email: `${uniqueId('superadmin')}@example.com`,
        password: passwordHash,
        nombre: 'Super Admin',
        rol: 'SUPER_ADMIN',
        activo: true
      }
    });
    token = signTokenForUser(superadmin);

    await prisma.pedido.createMany({
      data: [
        {
          tenantId: tenantActivo.id,
          tipo: 'MOSTRADOR',
          subtotal: 100,
          total: 100,
          estadoPago: 'APROBADO'
        },
        {
          tenantId: tenantActivo.id,
          tipo: 'MOSTRADOR',
          subtotal: 50,
          total: 50,
          estadoPago: 'PENDIENTE'
        }
      ]
    });
  });

  afterAll(async () => {
    await cleanupTenantData(tenantActivo.id);
    await cleanupTenantData(tenantInactivo.id);
    await prisma.usuario.delete({ where: { id: superadmin.id } });
    await prisma.$disconnect();
  });

  it('GET /api/super-admin/tenants lista tenants con paginación', async () => {
    const response = await request(app)
      .get('/api/super-admin/tenants')
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(response.body.pagination.page).toBe(1);
    expect(response.body.pagination.limit).toBe(20);

    const ids = response.body.tenants.map(t => t.id);
    expect(ids).toContain(tenantActivo.id);
    expect(ids).toContain(tenantInactivo.id);
  });

  it('GET /api/super-admin/tenants filtra por activo=false', async () => {
    const response = await request(app)
      .get('/api/super-admin/tenants?activo=false')
      .set('Authorization', authHeader(token))
      .expect(200);

    const ids = response.body.tenants.map(t => t.id);
    expect(ids).toContain(tenantInactivo.id);
    expect(ids).not.toContain(tenantActivo.id);
  });

  it('GET /api/super-admin/tenants/:id devuelve detalle con counts', async () => {
    const response = await request(app)
      .get(`/api/super-admin/tenants/${tenantActivo.id}`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(response.body.id).toBe(tenantActivo.id);
    expect(response.body._count).toBeDefined();
    expect(response.body._count.pedidos).toBe(2);
  });

  it('PATCH /api/super-admin/tenants/:id/toggle actualiza activo', async () => {
    const response = await request(app)
      .patch(`/api/super-admin/tenants/${tenantInactivo.id}/toggle`)
      .set('Authorization', authHeader(token))
      .send({ activo: true })
      .expect(200);

    expect(response.body.message).toBe('Restaurante activado');
    expect(response.body.tenant.activo).toBe(true);
  });

  it('GET /api/super-admin/tenants/:id/metricas devuelve métricas', async () => {
    const response = await request(app)
      .get(`/api/super-admin/tenants/${tenantActivo.id}/metricas`)
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(response.body.tenant.id).toBe(tenantActivo.id);
    expect(response.body.metricas.pedidos.hoy).toBe(2);
    expect(Number(response.body.metricas.ventas.hoy)).toBe(100);
  });

  it('GET /api/super-admin/metricas devuelve métricas globales', async () => {
    const response = await request(app)
      .get('/api/super-admin/metricas')
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(response.body.tenants.total).toBeGreaterThanOrEqual(2);
    expect(response.body.pedidos.hoy).toBeGreaterThanOrEqual(2);
    expect(Number(response.body.ventas.hoy)).toBeGreaterThanOrEqual(100);
  });
});

