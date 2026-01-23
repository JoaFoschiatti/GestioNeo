jest.mock('../services/email.service', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(null)
}));

const request = require('supertest');
const app = require('../app');
const {
  prisma,
  uniqueId,
  cleanupTenantData
} = require('./helpers/test-helpers');

describe('Registro Endpoints', () => {
  let tenantId;
  let usuarioId;
  let token;
  let slug;
  let email;

  beforeAll(async () => {
    slug = uniqueId('registro');
    email = `${uniqueId('registro')}@example.com`;

    await request(app)
      .post('/api/registro')
      .send({
        nombreRestaurante: 'Restaurante Test',
        slug,
        nombre: 'Admin Test',
        email,
        password: '123456'
      })
      .expect(201);

    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    tenantId = tenant.id;

    const usuario = await prisma.usuario.findFirst({
      where: { tenantId, email }
    });
    usuarioId = usuario.id;

    const verificacion = await prisma.emailVerificacion.findFirst({
      where: { tenantId, usuarioId },
      orderBy: { createdAt: 'asc' }
    });
    token = verificacion.token;
  });

  afterAll(async () => {
    await cleanupTenantData(tenantId);
    await prisma.$disconnect();
  });

  it('GET /api/registro/slug/:slug indica que ya está en uso', async () => {
    const response = await request(app)
      .get(`/api/registro/slug/${slug}`)
      .expect(200);

    expect(response.body.disponible).toBe(false);
    expect(response.body.razon).toBe('en_uso');
  });

  it('POST /api/registro/reenviar crea nuevo token para usuario no verificado', async () => {
    const prevCount = await prisma.emailVerificacion.count({
      where: { tenantId, usuarioId }
    });

    const response = await request(app)
      .post('/api/registro/reenviar')
      .send({ email })
      .expect(200);

    expect(response.body.message).toBe('Si el email está registrado, recibirás un nuevo enlace de verificación.');

    const nextCount = await prisma.emailVerificacion.count({
      where: { tenantId, usuarioId }
    });

    expect(nextCount).toBe(prevCount + 1);
  });

  it('GET /api/registro/verificar/:token activa tenant y usuario', async () => {
    const response = await request(app)
      .get(`/api/registro/verificar/${token}`)
      .expect(200);

    expect(response.body.message).toBe('Email verificado correctamente. Tu restaurante ya está activo.');
    expect(response.body.tenant.slug).toBe(slug);

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    const verificacion = await prisma.emailVerificacion.findUnique({ where: { token } });

    expect(tenant.activo).toBe(true);
    expect(usuario.activo).toBe(true);
    expect(verificacion.usedAt).not.toBeNull();
  });

  it('GET /api/registro/verificar/:token rechaza token inválido', async () => {
    const response = await request(app)
      .get('/api/registro/verificar/token-invalido')
      .expect(400);

    expect(response.body.error.message).toBe('Token de verificación inválido');
  });
});

