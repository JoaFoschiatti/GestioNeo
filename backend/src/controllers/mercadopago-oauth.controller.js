/**
 * Controlador de OAuth y configuración de MercadoPago por Tenant
 */

const { prisma } = require('../db/prisma');
const { encrypt } = require('../services/crypto.service');
const {
  getMercadoPagoConfigInfo,
  getTransactionHistory
} = require('../services/mercadopago.service');

/**
 * GET /api/mercadopago/oauth/authorize
 * Genera URL de autorización OAuth de MercadoPago
 */
const iniciarOAuth = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    if (!process.env.MP_APP_ID) {
      return res.status(500).json({
        error: { message: 'OAuth de MercadoPago no está configurado en el servidor' }
      });
    }

    // Codificar state con tenantId para el callback
    const state = Buffer.from(JSON.stringify({
      tenantId,
      timestamp: Date.now()
    })).toString('base64url');

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

    const authUrl = new URL('https://auth.mercadopago.com/authorization');
    authUrl.searchParams.set('client_id', process.env.MP_APP_ID);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('platform_id', 'mp');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('redirect_uri', `${backendUrl}/api/mercadopago/oauth/callback`);

    res.json({ authUrl: authUrl.toString() });
  } catch (error) {
    console.error('Error al iniciar OAuth:', error);
    res.status(500).json({ error: { message: 'Error al iniciar autorización' } });
  }
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

    // Guardar tokens encriptados
    await prisma.mercadoPagoConfig.upsert({
      where: { tenantId },
      update: {
        accessToken: encrypt(tokenData.access_token),
        refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
        publicKey: tokenData.public_key || null,
        userId: tokenData.user_id?.toString() || null,
        email: userEmail,
        expiresAt: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : null,
        isOAuth: true,
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        tenantId,
        accessToken: encrypt(tokenData.access_token),
        refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
        publicKey: tokenData.public_key || null,
        userId: tokenData.user_id?.toString() || null,
        email: userEmail,
        expiresAt: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : null,
        isOAuth: true,
        isActive: true
      }
    });

    // Habilitar MercadoPago en configuración del tenant
    await prisma.configuracion.upsert({
      where: {
        tenantId_clave: { tenantId, clave: 'mercadopago_enabled' }
      },
      update: { valor: 'true' },
      create: { tenantId, clave: 'mercadopago_enabled', valor: 'true' }
    });

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
  try {
    const tenantId = req.tenantId;

    // Verificar que existe configuración
    const config = await prisma.mercadoPagoConfig.findUnique({
      where: { tenantId }
    });

    if (!config) {
      return res.status(404).json({
        error: { message: 'No hay cuenta de MercadoPago conectada' }
      });
    }

    // Desactivar (no borrar para mantener historial)
    await prisma.mercadoPagoConfig.update({
      where: { tenantId },
      data: { isActive: false }
    });

    // Deshabilitar en configuración
    await prisma.configuracion.upsert({
      where: {
        tenantId_clave: { tenantId, clave: 'mercadopago_enabled' }
      },
      update: { valor: 'false' },
      create: { tenantId, clave: 'mercadopago_enabled', valor: 'false' }
    });

    res.json({ message: 'MercadoPago desconectado correctamente' });
  } catch (error) {
    console.error('Error al desconectar MercadoPago:', error);
    res.status(500).json({ error: { message: 'Error al desconectar MercadoPago' } });
  }
};

/**
 * GET /api/mercadopago/status
 * Obtiene estado de conexión de MercadoPago del tenant
 */
const obtenerEstado = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const configInfo = await getMercadoPagoConfigInfo(tenantId);

    if (!configInfo) {
      return res.json({
        connected: false,
        config: null
      });
    }

    res.json({
      connected: configInfo.isActive && !configInfo.isExpired,
      config: {
        email: configInfo.email,
        isOAuth: configInfo.isOAuth,
        isActive: configInfo.isActive,
        isExpired: configInfo.isExpired,
        connectedAt: configInfo.createdAt,
        updatedAt: configInfo.updatedAt
      }
    });
  } catch (error) {
    console.error('Error al obtener estado de MercadoPago:', error);
    res.status(500).json({ error: { message: 'Error al obtener estado' } });
  }
};

/**
 * POST /api/mercadopago/config/manual
 * Configura MercadoPago manualmente con Access Token
 */
const configurarManual = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { accessToken, publicKey } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        error: { message: 'Access Token es requerido' }
      });
    }

    // Verificar que el token es válido consultando a MercadoPago
    const userResponse = await fetch('https://api.mercadopago.com/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!userResponse.ok) {
      return res.status(400).json({
        error: { message: 'Access Token inválido o expirado' }
      });
    }

    const userData = await userResponse.json();

    if (userData.error) {
      return res.status(400).json({
        error: { message: 'Access Token inválido' }
      });
    }

    // Guardar configuración
    await prisma.mercadoPagoConfig.upsert({
      where: { tenantId },
      update: {
        accessToken: encrypt(accessToken),
        publicKey: publicKey || null,
        refreshToken: null,
        userId: userData.id?.toString() || null,
        email: userData.email || null,
        expiresAt: null, // Tokens manuales no expiran automáticamente
        isOAuth: false,
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        tenantId,
        accessToken: encrypt(accessToken),
        publicKey: publicKey || null,
        userId: userData.id?.toString() || null,
        email: userData.email || null,
        isOAuth: false,
        isActive: true
      }
    });

    // Habilitar MercadoPago en configuración
    await prisma.configuracion.upsert({
      where: {
        tenantId_clave: { tenantId, clave: 'mercadopago_enabled' }
      },
      update: { valor: 'true' },
      create: { tenantId, clave: 'mercadopago_enabled', valor: 'true' }
    });

    res.json({
      message: 'MercadoPago configurado correctamente',
      email: userData.email
    });
  } catch (error) {
    console.error('Error al configurar MercadoPago manualmente:', error);
    res.status(500).json({
      error: { message: 'Error al configurar MercadoPago' }
    });
  }
};

/**
 * GET /api/mercadopago/transacciones
 * Obtiene historial de transacciones del tenant
 */
const listarTransacciones = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page, limit, desde, hasta, status } = req.query;

    const result = await getTransactionHistory(tenantId, {
      page: page || 1,
      limit: limit || 20,
      desde,
      hasta,
      status
    });

    res.json(result);
  } catch (error) {
    console.error('Error al listar transacciones:', error);
    res.status(500).json({
      error: { message: 'Error al obtener transacciones' }
    });
  }
};

module.exports = {
  iniciarOAuth,
  callbackOAuth,
  desconectarOAuth,
  obtenerEstado,
  configurarManual,
  listarTransacciones
};
