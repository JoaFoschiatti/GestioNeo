/**
 * Controlador de OAuth y configuración de MercadoPago por Tenant
 */

const { prisma } = require('../db/prisma');
const mercadoPagoConfigService = require('../services/mercadopago-config.service');
const { createHttpError } = require('../utils/http-error');

/**
 * GET /api/mercadopago/oauth/authorize
 * Genera URL de autorización OAuth de MercadoPago
 */
const iniciarOAuth = async (req, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw createHttpError.badRequest('Contexto de tenant requerido');
  }

  const authUrl = mercadoPagoConfigService.buildOAuthAuthorizationUrl(tenantId);
  res.json({ authUrl });
};

/**
 * GET /api/mercadopago/oauth/callback
 * Callback de OAuth - recibe código y lo intercambia por tokens
 */
const callbackOAuth = async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    // Si hubo error en OAuth
    if (oauthError) {
      console.error('Error en OAuth de MercadoPago:', oauthError);
      return res.redirect(`${frontendUrl}/admin/configuracion?mp=error&reason=${oauthError}`);
    }

    if (!code || !state) {
      return res.redirect(`${frontendUrl}/admin/configuracion?mp=error&reason=missing_params`);
    }

    // Decodificar state
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
      return res.redirect(`${frontendUrl}/admin/configuracion?mp=error&reason=invalid_state`);
    }

    const { tenantId } = stateData;

    if (!tenantId) {
      return res.redirect(`${frontendUrl}/admin/configuracion?mp=error&reason=invalid_tenant`);
    }

    // Verificar que el tenant existe
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.redirect(`${frontendUrl}/admin/configuracion?mp=error&reason=tenant_not_found`);
    }

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

    // Intercambiar código por tokens
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

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || tokenData.error) {
      console.error('Error al obtener tokens de MP:', tokenData);
      return res.redirect(`${frontendUrl}/admin/configuracion?mp=error&reason=token_exchange_failed`);
    }

    // Obtener info del usuario de MercadoPago
    let userEmail = null;
    try {
      const userResponse = await fetch('https://api.mercadopago.com/users/me', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      });
      const userData = await userResponse.json();
      userEmail = userData.email;
    } catch (e) {
      console.warn('No se pudo obtener email del usuario MP:', e);
    }

    await mercadoPagoConfigService.guardarOAuthConfig(tenantId, tokenData, userEmail);

    // Redirigir al frontend con éxito
    res.redirect(`${frontendUrl}/admin/configuracion?mp=connected`);
  } catch (error) {
    console.error('Error en callback de OAuth:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/admin/configuracion?mp=error&reason=server_error`);
  }
};

/**
 * DELETE /api/mercadopago/oauth/disconnect
 * Desconecta la cuenta de MercadoPago del tenant
 */
const desconectarOAuth = async (req, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw createHttpError.badRequest('Contexto de tenant requerido');
  }

  await mercadoPagoConfigService.desconectar(tenantId);
  res.json({ message: 'MercadoPago desconectado correctamente' });
};

/**
 * GET /api/mercadopago/status
 * Obtiene estado de conexión de MercadoPago del tenant
 */
const obtenerEstado = async (req, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw createHttpError.badRequest('Contexto de tenant requerido');
  }

  res.json(await mercadoPagoConfigService.obtenerEstado(tenantId));
};

/**
 * POST /api/mercadopago/config/manual
 * Configura MercadoPago manualmente con Access Token
 */
const configurarManual = async (req, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw createHttpError.badRequest('Contexto de tenant requerido');
  }

  const { accessToken, publicKey } = req.body;
  res.json(await mercadoPagoConfigService.configurarManual(tenantId, { accessToken, publicKey }));
};

/**
 * GET /api/mercadopago/transacciones
 * Obtiene historial de transacciones del tenant
 */
const listarTransacciones = async (req, res) => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw createHttpError.badRequest('Contexto de tenant requerido');
  }

  const { page, limit, desde, hasta, status } = req.query;
  res.json(await mercadoPagoConfigService.listarTransacciones(tenantId, { page, limit, desde, hasta, status }));
};

module.exports = {
  iniciarOAuth,
  callbackOAuth,
  desconectarOAuth,
  obtenerEstado,
  configurarManual,
  listarTransacciones
};
