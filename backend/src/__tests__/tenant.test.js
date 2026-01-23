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

describe('Tenant Endpoints', () => {
  let tenant;
  let token;
  let tenantSecundario;

  beforeAll(async () => {
    tenant = await createTenant();
    const admin = await createUsuario(tenant.id, {
      email: `${uniqueId('admin')}@example.com`,
      rol: 'ADMIN'
    });
    token = signTokenForUser(admin);

    tenantSecundario = await createTenant();
  });

  afterAll(async () => {
    await cleanupTenantData(tenant.id);
    await cleanupTenantData(tenantSecundario.id);
    await prisma.$disconnect();
  });

  it('GET /api/tenant devuelve datos del tenant actual', async () => {
    const response = await request(app)
      .get('/api/tenant')
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(response.body.id).toBe(tenant.id);
    expect(response.body.slug).toBeDefined();
    expect(response.body.nombre).toBeDefined();
    expect(response.body.createdAt).toBeDefined();
  });

  it('PUT /api/tenant actualiza nombre y sincroniza configuracion', async () => {
    const nombre = `Negocio ${uniqueId('nombre')}`;
    const slug = uniqueId('slug');

    const response = await request(app)
      .put('/api/tenant')
      .set('Authorization', authHeader(token))
      .send({ nombre, slug })
      .expect(200);

    expect(response.body.tenant.nombre).toBe(nombre);
    expect(response.body.tenant.slug).toBe(slug);
    expect(response.body.slugChanged).toBe(true);

    const configuracion = await prisma.configuracion.findUnique({
      where: {
        tenantId_clave: { tenantId: tenant.id, clave: 'nombre_negocio' }
      }
    });

    expect(configuracion.valor).toBe(nombre);
  });

  it('PUT /api/tenant rechaza slug duplicado', async () => {
    const response = await request(app)
      .put('/api/tenant')
      .set('Authorization', authHeader(token))
      .send({ slug: tenantSecundario.slug })
      .expect(400);

    expect(response.body.error.message).toBe('Este slug ya esta en uso por otro negocio');
  });

  it('GET /api/tenant/verificar-slug/:slug indica slug reservado', async () => {
    const response = await request(app)
      .get('/api/tenant/verificar-slug/admin')
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(response.body.slug).toBe('admin');
    expect(response.body.disponible).toBe(false);
    expect(response.body.error).toBe('Este slug esta reservado y no puede usarse');
  });
});

