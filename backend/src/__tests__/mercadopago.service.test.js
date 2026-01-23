jest.mock('../db/prisma', () => ({
  prisma: {
    mercadoPagoConfig: {
      findUnique: jest.fn(),
      update: jest.fn()
    }
  }
}));

jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest.fn(function ({ accessToken }) {
    this.accessToken = accessToken;
  }),
  Preference: jest.fn(),
  Payment: jest.fn()
}));

const { prisma } = require('../db/prisma');
const { MercadoPagoConfig } = require('mercadopago');
const { encrypt, generateEncryptionKey } = require('../services/crypto.service');
const { getMercadoPagoClient } = require('../services/mercadopago.service');

describe('mercadopago.service', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    prisma.mercadoPagoConfig.findUnique.mockReset();
    prisma.mercadoPagoConfig.update.mockReset();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    global.fetch = jest.fn();
    process.env.ENCRYPTION_KEY = generateEncryptionKey();
    process.env.MP_APP_ID = 'mp-app-id';
    process.env.MP_APP_SECRET = 'mp-app-secret';
  });

  afterEach(() => {
    console.warn.mockRestore();
    global.fetch = originalFetch;
  });

  it('refresca tokens OAuth expirados', async () => {
    const accessToken = encrypt('old-access');
    const refreshToken = encrypt('refresh-token');

    prisma.mercadoPagoConfig.findUnique.mockResolvedValueOnce({
      tenantId: 1,
      isActive: true,
      isOAuth: true,
      expiresAt: new Date(Date.now() - 1000),
      accessToken,
      refreshToken
    });

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 3600
      })
    });

    const client = await getMercadoPagoClient(1);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.mercadopago.com/oauth/token',
      expect.objectContaining({ method: 'POST' })
    );
    expect(prisma.mercadoPagoConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 1 },
        data: expect.objectContaining({
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          isActive: true
        })
      })
    );
    expect(MercadoPagoConfig).toHaveBeenCalledWith({ accessToken: 'new-access' });
    expect(client).toBeInstanceOf(MercadoPagoConfig);
  });

  it('retorna null si el refresco falla', async () => {
    const accessToken = encrypt('old-access');
    const refreshToken = encrypt('refresh-token');

    prisma.mercadoPagoConfig.findUnique.mockResolvedValueOnce({
      tenantId: 1,
      isActive: true,
      isOAuth: true,
      expiresAt: new Date(Date.now() - 1000),
      accessToken,
      refreshToken
    });

    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'invalid_grant' })
    });

    const client = await getMercadoPagoClient(1);
    expect(client).toBeNull();
  });
});
