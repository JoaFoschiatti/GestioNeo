const { prisma } = require('../db/prisma');
const { encrypt } = require('./crypto.service');
const { createHttpError } = require('../utils/http-error');
const { getMercadoPagoConfigInfo, getTransactionHistory } = require('./mercadopago.service');

const buildOAuthAuthorizationUrl = () => {
  if (!process.env.MP_APP_ID) {
    throw createHttpError.internal('OAuth de MercadoPago no está configurado en el servidor');
  }

  const state = Buffer.from(JSON.stringify({
    timestamp: Date.now()
  })).toString('base64url');

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
    throw createHttpError.badRequest('Access Token inválido o expirado');
  }

  const userData = await userResponse.json();
  if (userData.error) {
    throw createHttpError.badRequest('Access Token inválido');
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
  guardarOAuthConfig,
  desconectar,
  obtenerEstado,
  configurarManual,
  listarTransacciones
};
