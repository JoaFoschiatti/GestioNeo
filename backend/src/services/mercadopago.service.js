/**
 * Servicio de MercadoPago (instancia unica)
 * Obtiene credenciales del negocio y crea clientes de MercadoPago
 */

const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const { prisma } = require('../db/prisma');
const { decrypt, encrypt } = require('./crypto.service');

const refreshOAuthToken = async (config) => {
  if (!config?.refreshToken) {
    return null;
  }

  if (!process.env.MP_APP_ID || !process.env.MP_APP_SECRET) {
    console.warn('MercadoPago OAuth no configurado para refresco de token');
    return null;
  }

  let refreshToken;
  try {
    refreshToken = decrypt(config.refreshToken);
  } catch (error) {
    console.error('Error al desencriptar refresh token de MP:', error);
    return null;
  }

  const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.MP_APP_ID,
      client_secret: process.env.MP_APP_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });

  const tokenData = await tokenResponse.json().catch(() => ({}));

  if (!tokenResponse.ok || tokenData.error) {
    console.warn('Error al refrescar token de MP:', tokenData);
    return null;
  }

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000)
    : null;

  await prisma.mercadoPagoConfig.update({
    where: { id: 1 },
    data: {
      accessToken: encrypt(tokenData.access_token),
      refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : config.refreshToken,
      expiresAt,
      isActive: true,
      updatedAt: new Date()
    }
  });

  return tokenData.access_token;
};

/**
 * Obtiene un cliente de MercadoPago configurado
 * @returns {MercadoPagoConfig|null} - Cliente configurado o null si no hay configuración
 */
async function getMercadoPagoClient() {
  const config = await prisma.mercadoPagoConfig.findUnique({
    where: { id: 1 }
  });

  if (!config || !config.isActive) {
    return null;
  }

  // Verificar si el token expiró (para OAuth)
  if (config.isOAuth && config.expiresAt && new Date() > config.expiresAt) {
    const refreshedToken = await refreshOAuthToken(config);
    if (!refreshedToken) {
      console.warn('Token de MercadoPago expirado');
      return null;
    }
    return new MercadoPagoConfig({ accessToken: refreshedToken });
  }

  try {
    const accessToken = decrypt(config.accessToken);
    return new MercadoPagoConfig({ accessToken });
  } catch (error) {
    console.error('Error al desencriptar token de MP:', error);
    return null;
  }
}

/**
 * Verifica si MercadoPago está configurado y activo
 * @returns {boolean}
 */
async function isMercadoPagoConfigured() {
  const config = await prisma.mercadoPagoConfig.findUnique({
    where: { id: 1 },
    select: { isActive: true, expiresAt: true, isOAuth: true }
  });

  if (!config || !config.isActive) {
    return false;
  }

  // Si es OAuth y expiró, no está disponible
  if (config.isOAuth && config.expiresAt && new Date() > config.expiresAt) {
    return false;
  }

  return true;
}

/**
 * Obtiene información de la configuración de MP (sin exponer el token)
 * @returns {object|null} - Info de configuración o null
 */
async function getMercadoPagoConfigInfo() {
  const config = await prisma.mercadoPagoConfig.findUnique({
    where: { id: 1 },
    select: {
      email: true,
      userId: true,
      isOAuth: true,
      isActive: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!config) {
    return null;
  }

  return {
    ...config,
    isExpired: config.isOAuth && config.expiresAt && new Date() > config.expiresAt
  };
}

/**
 * Crea una preferencia de pago en MercadoPago
 * @param {object} preferenceData - Datos de la preferencia
 * @returns {Promise<object>} - Respuesta de MercadoPago
 */
async function createPreference(preferenceData) {
  const client = await getMercadoPagoClient();

  if (!client) {
    throw new Error('MercadoPago no está configurado para este negocio');
  }

  const preference = new Preference(client);
  return preference.create({ body: preferenceData });
}

/**
 * Obtiene información de un pago desde MercadoPago
 * @param {string} paymentId - ID del pago en MercadoPago
 * @returns {Promise<object>} - Información del pago
 */
async function getPayment(paymentId) {
  const client = await getMercadoPagoClient();

  if (!client) {
    throw new Error('MercadoPago no está configurado para este negocio');
  }

  const payment = new Payment(client);
  return payment.get({ id: paymentId });
}

/**
 * Busca pagos por external_reference en MercadoPago
 * @param {string} externalReference - Referencia externa (formato: pedido-{pedidoId})
 * @returns {Promise<object|null>} - Pago aprobado si existe, null si no
 */
async function searchPaymentByReference(externalReference) {
  const client = await getMercadoPagoClient();

  if (!client) {
    return null;
  }

  try {
    const payment = new Payment(client);
    const result = await payment.search({
      options: {
        criteria: 'desc',
        sort: 'date_created',
        external_reference: externalReference
      }
    });

    // Buscar pago aprobado
    const pagoAprobado = result.results?.find(p => p.status === 'approved');
    return pagoAprobado || null;
  } catch (error) {
    console.error(`Error buscando pago por referencia ${externalReference}:`, error);
    return null;
  }
}

/**
 * Guarda una transacción de MercadoPago en el historial
 * @param {object} paymentInfo - Información del pago de MercadoPago
 * @param {number|null} pagoId - ID del pago local (opcional)
 * @returns {Promise<object>} - Transacción creada
 */
async function saveTransaction(paymentInfo, pagoId = null) {
  // Usar transacción con nivel de aislamiento serializable para evitar race conditions
  return prisma.$transaction(async (tx) => {
    return tx.transaccionMercadoPago.upsert({
      where: { mpPaymentId: paymentInfo.id.toString() },
      update: {
        status: paymentInfo.status,
        statusDetail: paymentInfo.status_detail,
        pagoId
      },
      create: {
        pagoId,
        mpPaymentId: paymentInfo.id.toString(),
        mpPreferenceId: paymentInfo.preference_id || null,
        status: paymentInfo.status,
        statusDetail: paymentInfo.status_detail,
        amount: paymentInfo.transaction_amount,
        currency: paymentInfo.currency_id || 'ARS',
        payerEmail: paymentInfo.payer?.email || null,
        paymentMethod: paymentInfo.payment_method_id || null,
        paymentTypeId: paymentInfo.payment_type_id || null,
        installments: paymentInfo.installments || null,
        fee: paymentInfo.fee_details?.reduce((sum, f) => sum + f.amount, 0) || null,
        netAmount: paymentInfo.transaction_details?.net_received_amount || null,
        externalReference: paymentInfo.external_reference || null,
        rawData: paymentInfo
      }
    });
  }, {
    isolationLevel: 'Serializable'
  });
}

/**
 * Obtiene el historial de transacciones
 * @param {object} options - Opciones de filtrado y paginación
 * @returns {Promise<object>} - Transacciones y metadata
 */
async function getTransactionHistory(options = {}) {
  const {
    page = 1,
    limit = 20,
    desde = null,
    hasta = null,
    status = null
  } = options;

  const where = {};

  if (desde || hasta) {
    where.createdAt = {};
    if (desde) where.createdAt.gte = new Date(desde);
    if (hasta) where.createdAt.lte = new Date(hasta);
  }

  if (status) {
    where.status = status;
  }

  const [transacciones, total] = await Promise.all([
    prisma.transaccionMercadoPago.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit),
      include: {
        pago: {
          include: {
            pedido: {
              select: {
                id: true,
                clienteNombre: true,
                total: true,
                createdAt: true
              }
            }
          }
        }
      }
    }),
    prisma.transaccionMercadoPago.count({ where })
  ]);

  // Calcular totales de transacciones aprobadas
  const totalesWhere = { ...where, status: 'approved' };
  const totales = await prisma.transaccionMercadoPago.aggregate({
    where: totalesWhere,
    _sum: {
      amount: true,
      fee: true,
      netAmount: true
    },
    _count: true
  });

  return {
    transacciones,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    },
    totales: {
      bruto: totales._sum.amount || 0,
      comisiones: totales._sum.fee || 0,
      neto: totales._sum.netAmount || 0,
      cantidadAprobadas: totales._count || 0
    }
  };
}

module.exports = {
  getMercadoPagoClient,
  isMercadoPagoConfigured,
  getMercadoPagoConfigInfo,
  createPreference,
  getPayment,
  searchPaymentByReference,
  saveTransaction,
  getTransactionHistory
};
