const crypto = require('crypto');
const mercadoPagoConfigService = require('../services/mercadopago-config.service');

describe('mercadopago-config.service OAuth state', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.MP_APP_ID = 'mp-app-id-test';
    process.env.MP_APP_SECRET = 'mp-app-secret-test';
    process.env.JWT_SECRET = 'jwt-secret-test';
    process.env.BACKEND_URL = 'http://localhost:3001';
    process.env.MP_OAUTH_STATE_MAX_AGE_MS = '600000';
  });

  afterEach(() => {
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.entries(originalEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });
  });

  it('genera un state verificable en la URL de OAuth', () => {
    const authUrl = new URL(mercadoPagoConfigService.buildOAuthAuthorizationUrl());
    const state = authUrl.searchParams.get('state');

    expect(state).toBeTruthy();
    expect(mercadoPagoConfigService.verifyOAuthState(state)).toBe(true);
  });

  it('rechaza un state manipulado', () => {
    const authUrl = new URL(mercadoPagoConfigService.buildOAuthAuthorizationUrl());
    const state = authUrl.searchParams.get('state');

    const [payload, signature] = state.split('.');
    const tampered = `${payload}.${signature.slice(0, -1)}x`;

    expect(mercadoPagoConfigService.verifyOAuthState(tampered)).toBe(false);
  });

  it('rechaza state expirado', () => {
    const payload = Buffer.from(
      JSON.stringify({
        ts: Date.now() - (11 * 60 * 1000),
        nonce: 'nonce-expired'
      }),
      'utf8'
    ).toString('base64url');

    const signature = crypto
      .createHmac('sha256', process.env.JWT_SECRET)
      .update(payload)
      .digest('base64url');

    expect(mercadoPagoConfigService.verifyOAuthState(`${payload}.${signature}`)).toBe(false);
  });
});
