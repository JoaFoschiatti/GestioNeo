/**
 * Servicio de Suscripciones SaaS
 * Maneja las suscripciones de tenants usando MercadoPago Preapproval
 *
 * IMPORTANTE: Las suscripciones usan las credenciales del SaaS (no de cada tenant)
 * porque los pagos van al dueño del SaaS, no a cada restaurante.
 */

const { MercadoPagoConfig, PreApproval } = require('mercadopago');
const { prisma } = require('../db/prisma');
const { createHttpError } = require('../utils/http-error');
const { subscriptionCache } = require('../utils/cache');

const SUBSCRIPTION_PRICE = parseInt(process.env.SUBSCRIPTION_PRICE_ARS || '37000');

/**
 * Obtiene el cliente de MercadoPago del SaaS
 * @returns {MercadoPagoConfig|null}
 */
function getSaaSMercadoPagoClient() {
  const accessToken = process.env.MP_SAAS_ACCESS_TOKEN;

  if (!accessToken) {
    console.warn('MP_SAAS_ACCESS_TOKEN no configurado');
    return null;
  }

  return new MercadoPagoConfig({ accessToken });
}

/**
 * Crea una suscripción en MercadoPago para un tenant
 * @param {number} tenantId - ID del tenant
 * @returns {Promise<object>} - { initPoint, suscripcion }
 */
async function crearSuscripcion(tenantId) {
  const client = getSaaSMercadoPagoClient();

  if (!client) {
    throw createHttpError.serviceUnavailable('El servicio de suscripciones no está configurado. Contacta al administrador.');
  }

  // Obtener datos del tenant
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, nombre: true, email: true, slug: true }
  });

  if (!tenant) {
    throw createHttpError.notFound('Restaurante no encontrado');
  }

  // Verificar si ya tiene suscripción activa
  const suscripcionExistente = await prisma.suscripcion.findUnique({
    where: { tenantId }
  });

  if (suscripcionExistente?.estado === 'ACTIVA') {
    throw createHttpError.conflict('Ya tienes una suscripción activa');
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const backUrl = `${frontendUrl}/${tenant.slug}/configuracion?tab=suscripcion`;

  // Crear preapproval en MercadoPago
  const preapproval = new PreApproval(client);

  const preapprovalData = {
    reason: `Suscripción Comanda - ${tenant.nombre}`,
    external_reference: `comanda-tenant-${tenantId}`,
    payer_email: tenant.email,
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: SUBSCRIPTION_PRICE,
      currency_id: 'ARS'
    },
    back_url: backUrl,
    status: 'pending' // Usuario debe autorizar en checkout
  };

  const response = await preapproval.create({ body: preapprovalData });

  // Crear o actualizar suscripción en BD
  const suscripcion = await prisma.suscripcion.upsert({
    where: { tenantId },
    update: {
      mpPreapprovalId: response.id,
      estado: 'PENDIENTE',
      precioMensual: SUBSCRIPTION_PRICE,
      updatedAt: new Date()
    },
    create: {
      tenantId,
      mpPreapprovalId: response.id,
      estado: 'PENDIENTE',
      precioMensual: SUBSCRIPTION_PRICE
    }
  });

  subscriptionCache.clear();

  return {
    initPoint: response.init_point,
    sandboxInitPoint: response.sandbox_init_point,
    suscripcion
  };
}

/**
 * Obtiene el estado de suscripción de un tenant
 * @param {number} tenantId - ID del tenant
 * @returns {Promise<object>}
 */
async function obtenerEstado(tenantId) {
  const suscripcion = await prisma.suscripcion.findUnique({
    where: { tenantId },
    include: {
      pagos: {
        orderBy: { createdAt: 'desc' },
        take: 5
      }
    }
  });

  if (!suscripcion) {
    return {
      estado: 'SIN_SUSCRIPCION',
      suscripcion: null,
      precio: SUBSCRIPTION_PRICE
    };
  }

  const ahora = new Date();
  const diasRestantes = suscripcion.fechaVencimiento
    ? Math.ceil((suscripcion.fechaVencimiento - ahora) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    estado: suscripcion.estado,
    suscripcion: {
      id: suscripcion.id,
      estado: suscripcion.estado,
      fechaInicio: suscripcion.fechaInicio,
      fechaVencimiento: suscripcion.fechaVencimiento,
      fechaProximoCobro: suscripcion.fechaProximoCobro,
      ultimoPagoExitoso: suscripcion.ultimoPagoExitoso,
      intentosFallidos: suscripcion.intentosFallidos,
      precioMensual: suscripcion.precioMensual,
      diasRestantes: diasRestantes > 0 ? diasRestantes : 0
    },
    ultimosPagos: suscripcion.pagos,
    precio: SUBSCRIPTION_PRICE
  };
}

/**
 * Cancela una suscripción
 * @param {number} tenantId - ID del tenant
 * @returns {Promise<object>}
 */
async function cancelarSuscripcion(tenantId) {
  const suscripcion = await prisma.suscripcion.findUnique({
    where: { tenantId }
  });

  if (!suscripcion) {
    throw createHttpError.notFound('No tienes suscripción para cancelar');
  }

  if (suscripcion.estado === 'CANCELADA') {
    throw createHttpError.conflict('La suscripción ya está cancelada');
  }

  // Cancelar en MercadoPago si tiene ID
  if (suscripcion.mpPreapprovalId) {
    const client = getSaaSMercadoPagoClient();
    if (client) {
      try {
        const preapproval = new PreApproval(client);
        await preapproval.update({
          id: suscripcion.mpPreapprovalId,
          body: { status: 'cancelled' }
        });
      } catch (error) {
        console.error('Error cancelando en MercadoPago:', error);
        // Continuar con la cancelación local
      }
    }
  }

  // Actualizar en BD
  const suscripcionActualizada = await prisma.suscripcion.update({
    where: { tenantId },
    data: {
      estado: 'CANCELADA',
      updatedAt: new Date()
    }
  });

  subscriptionCache.clear();

  return suscripcionActualizada;
}

/**
 * Obtiene el historial de pagos de suscripción
 * @param {number} tenantId - ID del tenant
 * @param {object} options - Opciones de paginación
 * @returns {Promise<object>}
 */
async function obtenerHistorialPagos(tenantId, options = {}) {
  const { page = 1, limit = 20 } = options;

  const suscripcion = await prisma.suscripcion.findUnique({
    where: { tenantId },
    select: { id: true }
  });

  if (!suscripcion) {
    return {
      pagos: [],
      pagination: { page: 1, limit, total: 0, pages: 0 }
    };
  }

  const [pagos, total] = await Promise.all([
    prisma.pagoSuscripcion.findMany({
      where: { suscripcionId: suscripcion.id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit)
    }),
    prisma.pagoSuscripcion.count({
      where: { suscripcionId: suscripcion.id }
    })
  ]);

  return {
    pagos,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

/**
 * Procesa webhook de suscripción de MercadoPago
 * @param {string} type - Tipo de notificación
 * @param {string} dataId - ID del recurso
 * @returns {Promise<void>}
 */
async function procesarWebhook(type, dataId) {
  const client = getSaaSMercadoPagoClient();

  if (!client) {
    console.error('Webhook de suscripción: MP no configurado');
    return;
  }

  if (type === 'subscription_preapproval') {
    await procesarPreapprovalWebhook(client, dataId);
  } else if (type === 'subscription_authorized_payment') {
    await procesarPagoWebhook(client, dataId);
  }
}

/**
 * Procesa notificación de cambio de estado de suscripción
 */
async function procesarPreapprovalWebhook(client, preapprovalId) {
  const preapproval = new PreApproval(client);
  const data = await preapproval.get({ id: preapprovalId });

  // Buscar suscripción por mpPreapprovalId
  const suscripcion = await prisma.suscripcion.findFirst({
    where: { mpPreapprovalId: preapprovalId }
  });

  if (!suscripcion) {
    // Intentar buscar por external_reference
    const externalRef = data.external_reference;
    if (externalRef?.startsWith('comanda-tenant-')) {
      const tenantId = parseInt(externalRef.replace('comanda-tenant-', ''));
      if (tenantId) {
        await prisma.suscripcion.upsert({
          where: { tenantId },
          update: {
            mpPreapprovalId: preapprovalId,
            mpPayerId: data.payer_id?.toString(),
            estado: mapearEstadoMP(data.status),
            updatedAt: new Date()
          },
          create: {
            tenantId,
            mpPreapprovalId: preapprovalId,
            mpPayerId: data.payer_id?.toString(),
            estado: mapearEstadoMP(data.status),
            precioMensual: SUBSCRIPTION_PRICE
          }
        });
        subscriptionCache.clear();
      }
    }
    return;
  }

  // Actualizar estado
  await prisma.suscripcion.update({
    where: { id: suscripcion.id },
    data: {
      mpPayerId: data.payer_id?.toString(),
      estado: mapearEstadoMP(data.status),
      updatedAt: new Date()
    }
  });

  subscriptionCache.clear();
}

/**
 * Procesa notificación de pago de cuota
 */
async function procesarPagoWebhook(client, paymentId) {
  // Obtener información del pago autorizado
  const response = await fetch(`https://api.mercadopago.com/authorized_payments/${paymentId}`, {
    headers: {
      'Authorization': `Bearer ${process.env.MP_SAAS_ACCESS_TOKEN}`
    }
  });

  if (!response.ok) {
    console.error('Error obteniendo pago autorizado:', await response.text());
    return;
  }

  const data = await response.json();

  // Buscar suscripción por preapproval_id
  const suscripcion = await prisma.suscripcion.findFirst({
    where: { mpPreapprovalId: data.preapproval_id }
  });

  if (!suscripcion) {
    console.error('Suscripción no encontrada para pago:', data.preapproval_id);
    return;
  }

  const pagoExistente = await prisma.pagoSuscripcion.findUnique({
    where: { mpPaymentId: paymentId.toString() }
  });

  if (pagoExistente) {
    // Actualizar pago existente
    await prisma.pagoSuscripcion.update({
      where: { id: pagoExistente.id },
      data: {
        mpStatus: data.status,
        mpStatusDetail: data.status_detail
      }
    });
  } else if (data.status === 'approved') {
    // Crear nuevo pago
    const ahora = new Date();
    const finPeriodo = new Date(ahora);
    finPeriodo.setMonth(finPeriodo.getMonth() + 1);

    await prisma.pagoSuscripcion.create({
      data: {
        suscripcionId: suscripcion.id,
        tenantId: suscripcion.tenantId,
        mpPaymentId: paymentId.toString(),
        mpStatus: data.status,
        mpStatusDetail: data.status_detail,
        monto: data.transaction_amount,
        comisionMp: data.fee_details?.reduce((sum, f) => sum + f.amount, 0) || null,
        montoNeto: data.transaction_details?.net_received_amount || null,
        periodoInicio: ahora,
        periodoFin: finPeriodo,
        metodoPago: data.payment_method_id,
        rawData: data
      }
    });
  }

  // Actualizar estado de suscripción según el pago
  if (data.status === 'approved') {
    const fechaVencimiento = new Date();
    fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);

    await prisma.suscripcion.update({
      where: { id: suscripcion.id },
      data: {
        estado: 'ACTIVA',
        fechaVencimiento,
        fechaProximoCobro: fechaVencimiento,
        ultimoPagoExitoso: new Date(),
        intentosFallidos: 0,
        fechaInicio: suscripcion.fechaInicio || new Date(),
        updatedAt: new Date()
      }
    });
    subscriptionCache.clear();
  } else if (data.status === 'rejected') {
    const nuevoIntentos = suscripcion.intentosFallidos + 1;

    await prisma.suscripcion.update({
      where: { id: suscripcion.id },
      data: {
        intentosFallidos: nuevoIntentos,
        estado: nuevoIntentos >= 3 ? 'MOROSA' : suscripcion.estado,
        updatedAt: new Date()
      }
    });
    subscriptionCache.clear();
  }
}

/**
 * Mapea estado de MercadoPago a estado local
 */
function mapearEstadoMP(mpStatus) {
  switch (mpStatus) {
    case 'authorized':
      return 'ACTIVA';
    case 'pending':
      return 'PENDIENTE';
    case 'paused':
      return 'MOROSA';
    case 'cancelled':
      return 'CANCELADA';
    default:
      return 'PENDIENTE';
  }
}

/**
 * Verifica si un tenant tiene suscripción activa
 * @param {number} tenantId - ID del tenant
 * @returns {Promise<boolean>}
 */
async function tieneSuscripcionActiva(tenantId) {
  const suscripcion = await prisma.suscripcion.findUnique({
    where: { tenantId },
    select: { estado: true, fechaVencimiento: true }
  });

  if (!suscripcion) {
    return false;
  }

  if (suscripcion.estado !== 'ACTIVA') {
    return false;
  }

  if (!suscripcion.fechaVencimiento) {
    return false;
  }

  return suscripcion.fechaVencimiento > new Date();
}

module.exports = {
  crearSuscripcion,
  obtenerEstado,
  cancelarSuscripcion,
  obtenerHistorialPagos,
  procesarWebhook,
  tieneSuscripcionActiva,
  SUBSCRIPTION_PRICE
};
