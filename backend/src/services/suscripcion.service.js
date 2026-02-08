/**
 * Servicio de Suscripciones.
 * Usa una suscripción singleton (id=1) para el único negocio del sistema.
 */

const { MercadoPagoConfig, PreApproval } = require('mercadopago');
const { prisma } = require('../db/prisma');
const { createHttpError } = require('../utils/http-error');
const { subscriptionCache } = require('../utils/cache');

const SUBSCRIPTION_PRICE = parseInt(process.env.SUBSCRIPTION_PRICE_ARS || '37000', 10);
const SUSCRIPCION_ID = 1;
const NEGOCIO_ID = 1;

function getSaaSMercadoPagoClient() {
  const accessToken = process.env.MP_SAAS_ACCESS_TOKEN;

  if (!accessToken) {
    // eslint-disable-next-line no-console
    console.warn('MP_SAAS_ACCESS_TOKEN no configurado');
    return null;
  }

  return new MercadoPagoConfig({ accessToken });
}

async function getNegocioBasico() {
  return prisma.negocio.findUnique({
    where: { id: NEGOCIO_ID },
    select: { id: true, nombre: true, email: true }
  });
}

async function crearSuscripcion() {
  const client = getSaaSMercadoPagoClient();

  if (!client) {
    throw createHttpError.serviceUnavailable('El servicio de suscripciones no está configurado. Contacta al administrador.');
  }

  const negocio = await getNegocioBasico();
  if (!negocio) {
    throw createHttpError.notFound('Negocio no encontrado');
  }

  if (!negocio.email) {
    throw createHttpError.badRequest('El negocio no tiene email configurado para suscripción');
  }

  const suscripcionExistente = await prisma.suscripcion.findUnique({
    where: { id: SUSCRIPCION_ID }
  });

  const ahora = new Date();
  const suscripcionActiva = suscripcionExistente &&
    suscripcionExistente.estado === 'ACTIVA' &&
    suscripcionExistente.fechaVencimiento &&
    suscripcionExistente.fechaVencimiento > ahora;

  if (suscripcionActiva) {
    throw createHttpError.conflict('Ya tienes una suscripción activa');
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const backUrl = `${frontendUrl}/suscripcion`;

  const preapproval = new PreApproval(client);
  const preapprovalData = {
    reason: `Suscripción Comanda - ${negocio.nombre}`,
    external_reference: `comanda-suscripcion-${SUSCRIPCION_ID}`,
    payer_email: negocio.email,
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: SUBSCRIPTION_PRICE,
      currency_id: 'ARS'
    },
    back_url: backUrl,
    status: 'pending'
  };

  const response = await preapproval.create({ body: preapprovalData });

  const suscripcion = await prisma.suscripcion.upsert({
    where: { id: SUSCRIPCION_ID },
    update: {
      mpPreapprovalId: response.id,
      estado: 'PENDIENTE',
      precioMensual: SUBSCRIPTION_PRICE,
      updatedAt: new Date()
    },
    create: {
      id: SUSCRIPCION_ID,
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

async function obtenerEstado() {
  const suscripcion = await prisma.suscripcion.findUnique({
    where: { id: SUSCRIPCION_ID },
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

async function cancelarSuscripcion() {
  const suscripcion = await prisma.suscripcion.findUnique({
    where: { id: SUSCRIPCION_ID }
  });

  if (!suscripcion) {
    throw createHttpError.notFound('No tienes suscripción para cancelar');
  }

  if (suscripcion.estado === 'CANCELADA') {
    throw createHttpError.conflict('La suscripción ya está cancelada');
  }

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
        // eslint-disable-next-line no-console
        console.error('Error cancelando en MercadoPago:', error);
      }
    }
  }

  const suscripcionActualizada = await prisma.suscripcion.update({
    where: { id: SUSCRIPCION_ID },
    data: {
      estado: 'CANCELADA',
      updatedAt: new Date()
    }
  });

  subscriptionCache.clear();

  return suscripcionActualizada;
}

async function obtenerHistorialPagos(options = {}) {
  const { page = 1, limit = 20 } = options;

  const suscripcion = await prisma.suscripcion.findUnique({
    where: { id: SUSCRIPCION_ID },
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
      take: parseInt(limit, 10)
    }),
    prisma.pagoSuscripcion.count({
      where: { suscripcionId: suscripcion.id }
    })
  ]);

  return {
    pagos,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

async function procesarWebhook(type, dataId) {
  const client = getSaaSMercadoPagoClient();

  if (!client) {
    // eslint-disable-next-line no-console
    console.error('Webhook de suscripción: MP no configurado');
    return;
  }

  if (type === 'subscription_preapproval') {
    await procesarPreapprovalWebhook(client, dataId);
  } else if (type === 'subscription_authorized_payment') {
    await procesarPagoWebhook(client, dataId);
  }
}

async function procesarPreapprovalWebhook(client, preapprovalId) {
  const preapproval = new PreApproval(client);
  const data = await preapproval.get({ id: preapprovalId });

  await prisma.suscripcion.upsert({
    where: { id: SUSCRIPCION_ID },
    update: {
      mpPreapprovalId: preapprovalId,
      mpPayerId: data.payer_id?.toString() || null,
      estado: mapearEstadoMP(data.status),
      updatedAt: new Date()
    },
    create: {
      id: SUSCRIPCION_ID,
      mpPreapprovalId: preapprovalId,
      mpPayerId: data.payer_id?.toString() || null,
      estado: mapearEstadoMP(data.status),
      precioMensual: SUBSCRIPTION_PRICE
    }
  });

  subscriptionCache.clear();
}

async function procesarPagoWebhook(client, paymentId) {
  const response = await fetch(`https://api.mercadopago.com/authorized_payments/${paymentId}`, {
    headers: {
      'Authorization': `Bearer ${process.env.MP_SAAS_ACCESS_TOKEN}`
    }
  });

  if (!response.ok) {
    // eslint-disable-next-line no-console
    console.error('Error obteniendo pago autorizado:', await response.text());
    return;
  }

  const data = await response.json();

  const suscripcion = await prisma.suscripcion.findUnique({
    where: { id: SUSCRIPCION_ID }
  });

  if (!suscripcion) {
    // eslint-disable-next-line no-console
    console.error('Suscripción no encontrada para pago autorizado');
    return;
  }

  const pagoExistente = await prisma.pagoSuscripcion.findUnique({
    where: { mpPaymentId: paymentId.toString() }
  });

  if (pagoExistente) {
    await prisma.pagoSuscripcion.update({
      where: { id: pagoExistente.id },
      data: {
        mpStatus: data.status,
        mpStatusDetail: data.status_detail
      }
    });
  } else if (data.status === 'approved') {
    const ahora = new Date();
    const finPeriodo = new Date(ahora);
    finPeriodo.setMonth(finPeriodo.getMonth() + 1);

    await prisma.pagoSuscripcion.create({
      data: {
        suscripcionId: SUSCRIPCION_ID,
        mpPaymentId: paymentId.toString(),
        mpStatus: data.status,
        mpStatusDetail: data.status_detail,
        monto: data.transaction_amount,
        comisionMp: data.fee_details?.reduce((sum, fee) => sum + fee.amount, 0) || null,
        montoNeto: data.transaction_details?.net_received_amount || null,
        periodoInicio: ahora,
        periodoFin: finPeriodo,
        metodoPago: data.payment_method_id,
        rawData: data
      }
    });
  }

  if (data.status === 'approved') {
    const fechaVencimiento = new Date();
    fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);

    await prisma.suscripcion.update({
      where: { id: SUSCRIPCION_ID },
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
  } else if (data.status === 'rejected') {
    const nuevoIntentos = suscripcion.intentosFallidos + 1;

    await prisma.suscripcion.update({
      where: { id: SUSCRIPCION_ID },
      data: {
        intentosFallidos: nuevoIntentos,
        estado: nuevoIntentos >= 3 ? 'MOROSA' : suscripcion.estado,
        updatedAt: new Date()
      }
    });
  }

  subscriptionCache.clear();
}

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

async function tieneSuscripcionActiva() {
  const suscripcion = await prisma.suscripcion.findUnique({
    where: { id: SUSCRIPCION_ID },
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
