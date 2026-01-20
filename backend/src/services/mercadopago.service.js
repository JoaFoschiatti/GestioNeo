/**
 * Servicio de MercadoPago Multi-Tenant
 * Obtiene credenciales del tenant y crea clientes de MercadoPago dinámicamente
 */

const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const { prisma } = require('../db/prisma');
const { decrypt } = require('./crypto.service');

/**
 * Obtiene un cliente de MercadoPago configurado para un tenant específico
 * @param {number} tenantId - ID del tenant
 * @returns {MercadoPagoConfig|null} - Cliente configurado o null si no hay configuración
 */
async function getMercadoPagoClient(tenantId) {
  const config = await prisma.mercadoPagoConfig.findUnique({
    where: { tenantId }
  });

  if (!config || !config.isActive) {
    return null;
  }

  // Verificar si el token expiró (para OAuth)
  if (config.isOAuth && config.expiresAt && new Date() > config.expiresAt) {
    // TODO: Implementar refresh de token
    console.warn(`Token de MercadoPago expirado para tenant ${tenantId}`);
    return null;
  }

  try {
    const accessToken = decrypt(config.accessToken);
    return new MercadoPagoConfig({ accessToken });
  } catch (error) {
    console.error(`Error al desencriptar token de MP para tenant ${tenantId}:`, error);
    return null;
  }
}

/**
 * Verifica si un tenant tiene MercadoPago configurado y activo
 * @param {number} tenantId - ID del tenant
 * @returns {boolean}
 */
async function isMercadoPagoConfigured(tenantId) {
  const config = await prisma.mercadoPagoConfig.findUnique({
    where: { tenantId },
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
 * Obtiene información de la configuración de MP de un tenant (sin exponer el token)
 * @param {number} tenantId - ID del tenant
 * @returns {object|null} - Info de configuración o null
 */
async function getMercadoPagoConfigInfo(tenantId) {
  const config = await prisma.mercadoPagoConfig.findUnique({
    where: { tenantId },
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
 * @param {number} tenantId - ID del tenant
 * @param {object} preferenceData - Datos de la preferencia
 * @returns {Promise<object>} - Respuesta de MercadoPago
 */
async function createPreference(tenantId, preferenceData) {
  const client = await getMercadoPagoClient(tenantId);

  if (!client) {
    throw new Error('MercadoPago no está configurado para este negocio');
  }

  const preference = new Preference(client);
  return preference.create({ body: preferenceData });
}

/**
 * Obtiene información de un pago desde MercadoPago
 * @param {number} tenantId - ID del tenant
 * @param {string} paymentId - ID del pago en MercadoPago
 * @returns {Promise<object>} - Información del pago
 */
async function getPayment(tenantId, paymentId) {
  const client = await getMercadoPagoClient(tenantId);

  if (!client) {
    throw new Error('MercadoPago no está configurado para este negocio');
  }

  const payment = new Payment(client);
  return payment.get({ id: paymentId });
}

/**
 * Busca pagos por external_reference en MercadoPago
 * @param {number} tenantId - ID del tenant
 * @param {string} externalReference - Referencia externa (formato: tenantId-pedidoId)
 * @returns {Promise<object|null>} - Pago aprobado si existe, null si no
 */
async function searchPaymentByReference(tenantId, externalReference) {
  const client = await getMercadoPagoClient(tenantId);

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
 * @param {number} tenantId - ID del tenant
 * @param {object} paymentInfo - Información del pago de MercadoPago
 * @param {number|null} pagoId - ID del pago local (opcional)
 * @returns {Promise<object>} - Transacción creada
 */
async function saveTransaction(tenantId, paymentInfo, pagoId = null) {
  return prisma.transaccionMercadoPago.upsert({
    where: { mpPaymentId: paymentInfo.id.toString() },
    update: {
      status: paymentInfo.status,
      statusDetail: paymentInfo.status_detail,
      pagoId
    },
    create: {
      tenantId,
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
}

/**
 * Obtiene el historial de transacciones de un tenant
 * @param {number} tenantId - ID del tenant
 * @param {object} options - Opciones de filtrado y paginación
 * @returns {Promise<object>} - Transacciones y metadata
 */
async function getTransactionHistory(tenantId, options = {}) {
  const {
    page = 1,
    limit = 20,
    desde = null,
    hasta = null,
    status = null
  } = options;

  const where = { tenantId };

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
