const crypto = require('crypto');
const { prisma } = require('../db/prisma');
const { encrypt } = require('./crypto.service');
const { createHttpError } = require('../utils/http-error');
const { getMercadoPagoConfigInfo, getTransactionHistory } = require('./mercadopago.service');

const signState = (payload) => {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const secret = process.env.JWT_SECRET || 'dev-secret';
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
};

const verifyState = (state) => {
  const dotIndex = state.lastIndexOf('.');
  if (dotIndex === -1) return null;

  const data = state.slice(0, dotIndex);
  const signature = state.slice(dotIndex + 1);
  const secret = process.env.JWT_SECRET || 'dev-secret';
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    // Reject states older than 10 minutes
    if (Date.now() - payload.timestamp > 10 * 60 * 1000) return null;
    return payload;
  } catch {
    return null;
  }
};

const buildOAuthAuthorizationUrl = () => {
  if (!process.env.MP_APP_ID) {
    throw createHttpError.internal('OAuth de MercadoPago no esta configurado en el servidor');
  }

  const state = signState({ timestamp: Date.now() });

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  const authUrl = new URL('https://auth.mercadopago.com/authorization');
  authUrl.searchParams.set('client_id', process.env.MP_APP_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('platform_id', 'mp');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('redirect_uri', `${backendUrl}/api/mercadopago/oauth/callback`);

  return authUrl.toString();
};

const setMercadoPagoEnabled = (valor) => prisma.configuracion.upsert({
  where: { clave: 'mercadopago_enabled' },
  update: { valor: valor ? 'true' : 'false' },
  create: { clave: 'mercadopago_enabled', valor: valor ? 'true' : 'false' }
});

const guardarOAuthConfig = async (tokenData, userEmail) => {
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000)
    : null;

  await prisma.$transaction([
    prisma.mercadoPagoConfig.upsert({
      where: { id: 1 },
      update: {
        accessToken: encrypt(tokenData.access_token),
        refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
        publicKey: tokenData.public_key || null,
        userId: tokenData.user_id?.toString() || null,
        email: userEmail,
        expiresAt,
        isOAuth: true,
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        id: 1,
        accessToken: encrypt(tokenData.access_token),
        refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
        publicKey: tokenData.public_key || null,
        userId: tokenData.user_id?.toString() || null,
        email: userEmail,
        expiresAt,
        isOAuth: true,
        isActive: true
      }
    }),
    setMercadoPagoEnabled(true)
  ]);
};

const desconectar = async () => {
  const config = await prisma.mercadoPagoConfig.findUnique({
    where: { id: 1 }
  });

  if (!config) {
    throw createHttpError.notFound('No hay cuenta de MercadoPago conectada');
  }

  await prisma.$transaction([
    prisma.mercadoPagoConfig.update({
      where: { id: 1 },
      data: { isActive: false }
    }),
    setMercadoPagoEnabled(false)
  ]);
};

const obtenerEstado = async () => {
  const configInfo = await getMercadoPagoConfigInfo();

  if (!configInfo) {
    return { connected: false, config: null };
  }

  return {
    connected: configInfo.isActive && !configInfo.isExpired,
    config: {
      email: configInfo.email,
      isOAuth: configInfo.isOAuth,
      isActive: configInfo.isActive,
      isExpired: configInfo.isExpired,
      connectedAt: configInfo.createdAt,
      updatedAt: configInfo.updatedAt
    }
  };
};

const configurarManual = async ({ accessToken, publicKey }) => {
  const userResponse = await fetch('https://api.mercadopago.com/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!userResponse.ok) {
    throw createHttpError.badRequest('Access Token invalido o expirado');
  }

  const userData = await userResponse.json();
  if (userData.error) {
    throw createHttpError.badRequest('Access Token invalido');
  }

  await prisma.$transaction([
    prisma.mercadoPagoConfig.upsert({
      where: { id: 1 },
      update: {
        accessToken: encrypt(accessToken),
        publicKey: publicKey || null,
        refreshToken: null,
        userId: userData.id?.toString() || null,
        email: userData.email || null,
        expiresAt: null,
        isOAuth: false,
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        id: 1,
        accessToken: encrypt(accessToken),
        publicKey: publicKey || null,
        userId: userData.id?.toString() || null,
        email: userData.email || null,
        isOAuth: false,
        isActive: true
      }
    }),
    setMercadoPagoEnabled(true)
  ]);

  return {
    message: 'MercadoPago configurado correctamente',
    email: userData.email
  };
};

const listarTransacciones = async (options) => getTransactionHistory(options);

module.exports = {
  buildOAuthAuthorizationUrl,
  verifyState,
  guardarOAuthConfig,
  desconectar,
  obtenerEstado,
  configurarManual,
  listarTransacciones
};
