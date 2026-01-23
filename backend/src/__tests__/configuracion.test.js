const fs = require('fs');
const path = require('path');
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

describe('Configuracion Endpoints', () => {
  let tenant;
  let token;

  beforeAll(async () => {
    tenant = await createTenant();
    const admin = await createUsuario(tenant.id, {
      email: `${uniqueId('admin')}@example.com`,
      rol: 'ADMIN'
    });
    token = signTokenForUser(admin);
  });

  afterAll(async () => {
    await cleanupTenantData(tenant.id);
    await prisma.$disconnect();
  });

  it('GET /api/configuracion devuelve objeto de claves/valores', async () => {
    const response = await request(app)
      .get('/api/configuracion')
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(response.body).toEqual({});
  });

  it('PUT /api/configuracion/:clave upsertea un valor', async () => {
    const response = await request(app)
      .put('/api/configuracion/tienda_abierta')
      .set('Authorization', authHeader(token))
      .send({ valor: false })
      .expect(200);

    expect(response.body.clave).toBe('tienda_abierta');
    expect(response.body.valor).toBe('false');
    expect(response.body.tenantId).toBe(tenant.id);
  });

  it('PUT /api/configuracion (bulk) actualiza múltiples claves', async () => {
    const response = await request(app)
      .put('/api/configuracion')
      .set('Authorization', authHeader(token))
      .send({
        tienda_abierta: true,
        horario_apertura: '10:00'
      })
      .expect(200);

    expect(response.body.message).toBe('Configuraciones actualizadas');
    expect(response.body.count).toBe(2);

    const getResponse = await request(app)
      .get('/api/configuracion')
      .set('Authorization', authHeader(token))
      .expect(200);

    expect(getResponse.body.tienda_abierta).toBe('true');
    expect(getResponse.body.horario_apertura).toBe('10:00');
  });

  it('POST /api/configuracion/banner rechaza archivos no imagen', async () => {
    const response = await request(app)
      .post('/api/configuracion/banner')
      .set('Authorization', authHeader(token))
      .attach('banner', Buffer.from('hola'), 'banner.txt')
      .expect(400);

    expect(response.body.error.message).toBe('Solo se permiten imágenes (jpg, jpeg, png, webp)');
  });

  it('POST /api/configuracion/banner sube imagen y guarda banner_imagen', async () => {
    const pngMinimal = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100ffff03000006000557bf0a0000000049454e44ae426082',
      'hex'
    );

    const response = await request(app)
      .post('/api/configuracion/banner')
      .set('Authorization', authHeader(token))
      .attach('banner', pngMinimal, { filename: 'banner.png', contentType: 'image/png' })
      .expect(200);

    expect(response.body.message).toBe('Banner subido correctamente');
    expect(response.body.url).toMatch(/^\/uploads\/banner-/);

    const filename = response.body.url.replace('/uploads/', '');
    const filePath = path.join(__dirname, '../../uploads', filename);

    expect(fs.existsSync(filePath)).toBe(true);

    const config = await prisma.configuracion.findUnique({
      where: {
        tenantId_clave: { tenantId: tenant.id, clave: 'banner_imagen' }
      }
    });

    expect(config.valor).toBe(response.body.url);

    fs.unlinkSync(filePath);
  });
});
