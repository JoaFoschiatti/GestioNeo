const crypto = require('crypto');
const { prisma } = require('../db/prisma');
const { encrypt } = require('./crypto.service');
const { createHttpError } = require('../utils/http-error');
const { getMercadoPagoConfigInfo, getTransactionHistory } = require('./mercadopago.service');

const DEFAULT_OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;

const getOAuthStateSecret = () => process.env.JWT_SECRET || process.env.MP_APP_SECRET || null;

const getOAuthStateMaxAgeMs = () => {
  const parsed = parseInt(process.env.MP_OAUTH_STATE_MAX_AGE_MS || `${DEFAULT_OAUTH_STATE_MAX_AGE_MS}`, 10);
  if (Number.isNaN(parsed) || parsed < 30_000) {
    return DEFAULT_OAUTH_STATE_MAX_AGE_MS;
  }
  return parsed;
};

const safeTimingEqual = (left, right) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const createOAuthState = () => {
  const stateSecret = getOAuthStateSecret();
  if (!stateSecret) {
    throw createHttpError.internal('JWT_SECRET o MP_APP_SECRET deben estar configurados para OAuth');
  }

  const payload = {
    ts: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex')
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', stateSecret)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
};

const verifyOAuthState = (state) => {
  if (!state || typeof state !== 'string') {
    return false;
  }

  const [encodedPayload, signature, extra] = state.split('.');
  if (!encodedPayload || !signature || extra) {
    return false;
  }

  const stateSecret = getOAuthStateSecret();
  if (!stateSecret) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', stateSecret)
    .update(encodedPayload)
    .digest('base64url');

  if (!safeTimingEqual(signature, expectedSignature)) {
    return false;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch (_error) {
    return false;
  }

  const timestamp = Number(payload?.ts);
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  const now = Date.now();
  const maxAgeMs = getOAuthStateMaxAgeMs();
  if (timestamp > now + 60_000) {
    return false;
  }
  if ((now - timestamp) > maxAgeMs) {
    return false;
  }

  return true;
};

const buildOAuthAuthorizationUrl = () => {
  if (!process.env.MP_APP_ID) {
    throw createHttpError.internal('OAuth de MercadoPago no esta configurado en el servidor');
  }

  const state = createOAuthState();
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

  const authUrl = new URL('https://auth.mercadopago.com/authorization');
  authUrl.searchParams.set('client_id', process.env.MP_APP_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('platform_id', 'mp');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('redirect_uri', `${backendUrl}/api/mercadopago/oauth/callback`);

  return authUrl.toString();
};

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
    prisma.configuracion.upsert({
      where: { clave: 'mercadopago_enabled' },
      update: { valor: 'true' },
      create: { clave: 'mercadopago_enabled', valor: 'true' }
    })
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
    prisma.configuracion.upsert({
      where: { clave: 'mercadopago_enabled' },
      update: { valor: 'false' },
      create: { clave: 'mercadopago_enabled', valor: 'false' }
    })
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

const configurarManual = async (payload) => {
  const { accessToken, publicKey } = payload;

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
    prisma.configuracion.upsert({
      where: { clave: 'mercadopago_enabled' },
      update: { valor: 'true' },
      create: { clave: 'mercadopago_enabled', valor: 'true' }
    })
  ]);

  return {
    message: 'MercadoPago configurado correctamente',
    email: userData.email
  };
};

const listarTransacciones = async (options) => {
  return getTransactionHistory(options);
};

module.exports = {
  buildOAuthAuthorizationUrl,
  verifyOAuthState,
  guardarOAuthConfig,
  desconectar,
  obtenerEstado,
  configurarManual,
  listarTransacciones
};
