/**
 * Controlador de OAuth y configuracion de MercadoPago
 */

const mercadoPagoConfigService = require('../services/mercadopago-config.service');
const { logger } = require('../utils/logger');

const DEFAULT_FRONTEND_URL = 'http://localhost:5173';
const DEFAULT_BACKEND_URL = 'http://localhost:3001';

const resolveFrontendBaseUrl = () => {
  const raw = process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL;
  const first = raw
    .split(',')
    .map((value) => value.trim())
    .find(Boolean) || DEFAULT_FRONTEND_URL;

  try {
    return new URL(first).origin;
  } catch (_error) {
    return DEFAULT_FRONTEND_URL;
  }
};

const buildFrontendRedirect = ({ mp, reason }) => {
  const redirectUrl = new URL('/configuracion', resolveFrontendBaseUrl());
  redirectUrl.searchParams.set('mp', mp);
  if (reason) {
    redirectUrl.searchParams.set('reason', reason);
  }
  return redirectUrl.toString();
};

/**
 * GET /api/mercadopago/oauth/authorize
 * Genera URL de autorizacion OAuth de MercadoPago
 */
const iniciarOAuth = async (_req, res) => {
  const authUrl = mercadoPagoConfigService.buildOAuthAuthorizationUrl();
  res.json({ authUrl });
};

/**
 * GET /api/mercadopago/oauth/callback
 * Callback de OAuth - recibe codigo y lo intercambia por tokens
 */
const callbackOAuth = async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      logger.error('Error en OAuth de MercadoPago:', oauthError);
      return res.redirect(buildFrontendRedirect({ mp: 'error', reason: 'oauth_error' }));
    }

    if (!code || !state) {
      return res.redirect(buildFrontendRedirect({ mp: 'error', reason: 'missing_params' }));
    }

    if (!mercadoPagoConfigService.verifyOAuthState(state)) {
      return res.redirect(buildFrontendRedirect({ mp: 'error', reason: 'invalid_state' }));
    }

    const backendUrl = process.env.BACKEND_URL || DEFAULT_BACKEND_URL;

    const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.MP_APP_ID,
        client_secret: process.env.MP_APP_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${backendUrl}/api/mercadopago/oauth/callback`
      })
    });

    const tokenData = await tokenResponse.json().catch(() => ({}));

    if (!tokenResponse.ok || tokenData.error) {
      logger.error('Error al obtener tokens de MP:', tokenData);
      return res.redirect(buildFrontendRedirect({ mp: 'error', reason: 'token_exchange_failed' }));
    }

    let userEmail = null;
    try {
      const userResponse = await fetch('https://api.mercadopago.com/users/me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const userData = await userResponse.json().catch(() => ({}));
      userEmail = userData.email || null;
    } catch (error) {
      logger.warn('No se pudo obtener email del usuario MP:', error);
    }

    await mercadoPagoConfigService.guardarOAuthConfig(tokenData, userEmail);

    return res.redirect(buildFrontendRedirect({ mp: 'connected' }));
  } catch (error) {
    logger.error('Error en callback de OAuth:', error);
    return res.redirect(buildFrontendRedirect({ mp: 'error', reason: 'server_error' }));
  }
};

/**
 * DELETE /api/mercadopago/oauth/disconnect
 * Desconecta la cuenta de MercadoPago
 */
const desconectarOAuth = async (_req, res) => {
  await mercadoPagoConfigService.desconectar();
  res.json({ message: 'MercadoPago desconectado correctamente' });
};

/**
 * GET /api/mercadopago/status
 * Obtiene estado de conexion de MercadoPago
 */
const obtenerEstado = async (_req, res) => {
  res.json(await mercadoPagoConfigService.obtenerEstado());
};

/**
 * POST /api/mercadopago/config/manual
 * Configura MercadoPago manualmente con Access Token
 */
const configurarManual = async (req, res) => {
  const { accessToken, publicKey } = req.body;
  res.json(await mercadoPagoConfigService.configurarManual({ accessToken, publicKey }));
};

/**
 * GET /api/mercadopago/transacciones
 * Obtiene historial de transacciones
 */
const listarTransacciones = async (req, res) => {
  const { page, limit, desde, hasta, status } = req.query;
  res.json(await mercadoPagoConfigService.listarTransacciones({ page, limit, desde, hasta, status }));
};

module.exports = {
  iniciarOAuth,
  callbackOAuth,
  desconectarOAuth,
  obtenerEstado,
  configurarManual,
  listarTransacciones
};
