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

describe('MercadoPago OAuth Endpoints', () => {
  let tenant;
  let token;

  beforeAll(async () => {
    process.env.MP_APP_ID = 'test-mp-app-id';
    process.env.MP_APP_SECRET = 'test-mp-app-secret';
    process.env.BACKEND_URL = 'http://localhost:3001';
    process.env.FRONTEND_URL = 'http://frontend.local';

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

  it('GET /api/mercadopago/oauth/authorize devuelve authUrl', async () => {
    const response = await request(app)
      .get('/api/mercadopago/oauth/authorize')
      .set('Authorization', authHeader(token))
      .expect(200);

    const authUrl = new URL(response.body.authUrl);
    expect(authUrl.origin).toBe('https://auth.mercadopago.com');
    expect(authUrl.pathname).toBe('/authorization');
    expect(authUrl.searchParams.get('client_id')).toBe('test-mp-app-id');
    expect(authUrl.searchParams.get('redirect_uri')).toBe('http://localhost:3001/api/mercadopago/oauth/callback');
  });

  it('GET /api/mercadopago/oauth/callback redirige a missing_params', async () => {
    const response = await request(app)
      .get('/api/mercadopago/oauth/callback')
      .expect(302);

    expect(response.headers.location).toBe(`${process.env.FRONTEND_URL}/admin/configuracion?mp=error&reason=missing_params`);
  });

  it('GET /api/mercadopago/oauth/callback redirige a invalid_state', async () => {
    const response = await request(app)
      .get('/api/mercadopago/oauth/callback?code=abc&state=invalid')
      .expect(302);

    expect(response.headers.location).toBe(`${process.env.FRONTEND_URL}/admin/configuracion?mp=error&reason=invalid_state`);
  });

  it('GET /api/mercadopago/oauth/callback guarda config y redirige a connected', async () => {
    const state = Buffer.from(JSON.stringify({ tenantId: tenant.id, timestamp: Date.now() })).toString('base64url');

    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'ACCESS_TOKEN',
          refresh_token: 'REFRESH_TOKEN',
          public_key: 'PUBLIC_KEY',
          user_id: 123,
          expires_in: 3600
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'mp@example.com' })
      });

    const originalFetch = global.fetch;
    global.fetch = fetchMock;

    try {
      const response = await request(app)
        .get(`/api/mercadopago/oauth/callback?code=abc&state=${encodeURIComponent(state)}`)
        .expect(302);

      expect(response.headers.location).toBe(`${process.env.FRONTEND_URL}/admin/configuracion?mp=connected`);
    } finally {
      global.fetch = originalFetch;
    }

    const config = await prisma.mercadoPagoConfig.findUnique({
      where: { tenantId: tenant.id }
    });

    expect(config).toBeTruthy();
    expect(config.isActive).toBe(true);
    expect(config.isOAuth).toBe(true);
    expect(config.email).toBe('mp@example.com');

    const enabledConfig = await prisma.configuracion.findUnique({
      where: {
        tenantId_clave: { tenantId: tenant.id, clave: 'mercadopago_enabled' }
      }
    });
    expect(enabledConfig.valor).toBe('true');
  });
});
