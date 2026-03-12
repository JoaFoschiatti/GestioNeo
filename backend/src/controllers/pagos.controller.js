const crypto = require('crypto');
const eventBus = require('../services/event-bus');
const { getPrisma } = require('../utils/get-prisma');
const { getNegocio } = require('../db/prisma');
const emailService = require('../services/email.service');
const { getPayment, getQrOrder, saveTransaction } = require('../services/mercadopago.service');
const pagosService = require('../services/pagos.service');
const { logger } = require('../utils/logger');

const publishPedidoUpdated = (pedido) => {
  if (!pedido) {
    return;
  }

  eventBus.publish('pedido.updated', {
    id: pedido.id,
    estado: pedido.estado,
    estadoPago: pedido.estadoPago,
    tipo: pedido.tipo,
    mesaId: pedido.mesaId || null,
    updatedAt: pedido.updatedAt || new Date().toISOString()
  });
};

const publishMesaUpdated = (mesaUpdated) => {
  if (!mesaUpdated) {
    return;
  }

  eventBus.publish('mesa.updated', {
    mesaId: mesaUpdated.mesaId,
    estado: mesaUpdated.estado,
    updatedAt: new Date().toISOString()
  });
};

const parseExternalReference = (externalReference) => {
  const ref = externalReference?.toString() || '';
  const newMatch = ref.match(/^pedido-(\d+)$/);
  if (newMatch) {
    return { pedidoId: parseInt(newMatch[1], 10) };
  }

  const legacyMatch = ref.match(/^\d+-(\d+)$/);
  if (legacyMatch) {
    return { pedidoId: parseInt(legacyMatch[1], 10) };
  }

  return null;
};

const finalizeApprovedPedido = async (tx, pedidoId) => {
  const pedido = await tx.pedido.findUnique({
    where: { id: pedidoId },
    include: {
      pagos: true,
      items: { include: { producto: true } },
      mesa: true
    }
  });

  if (!pedido) {
    return null;
  }

  const totalAprobado = pedido.pagos
    .filter((pago) => pago.estado === 'APROBADO')
    .reduce((sum, pago) => sum + parseFloat(pago.monto), 0);

  const fullyPaid = totalAprobado >= parseFloat(pedido.total) - 0.01;
  let mesaUpdated = null;

  if (fullyPaid && pedido.mesaId) {
    await tx.mesa.update({
      where: { id: pedido.mesaId },
      data: { estado: 'CERRADA' }
    });
    mesaUpdated = { mesaId: pedido.mesaId, estado: 'CERRADA' };
  }

  const pedidoActualizado = await tx.pedido.update({
    where: { id: pedidoId },
    data: fullyPaid
      ? { estadoPago: 'APROBADO', estado: 'COBRADO' }
      : { estadoPago: 'PENDIENTE' },
    include: {
      items: { include: { producto: true } },
      mesa: true
    }
  });

  return {
    pedido: pedidoActualizado,
    mesaUpdated,
    totalPagado: totalAprobado,
    fullyPaid
  };
};

const registrarPago = async (req, res) => {
  const prisma = getPrisma(req);
  const {
    pedidoId,
    monto,
    metodo,
    canalCobro,
    propinaMonto,
    propinaMetodo,
    referencia,
    comprobante,
    montoAbonado
  } = req.body;

  const { pago, pedido, totalPagado, pendiente, mesaUpdated } = await pagosService.registrarPago(prisma, {
    pedidoId,
    monto,
    metodo,
    canalCobro,
    propinaMonto,
    propinaMetodo,
    referencia,
    comprobante,
    montoAbonado
  });

  eventBus.publish('pago.updated', {
    pedidoId,
    totalPagado,
    pendiente,
    estadoPedido: pedido.estado
  });

  publishMesaUpdated(mesaUpdated);

  if (pedido.estado === 'COBRADO') {
    publishPedidoUpdated(pedido);
  }

  res.status(201).json({
    pago,
    pedido,
    totalPagado,
    pendiente
  });
};

const crearPreferenciaMercadoPago = async (req, res) => {
  const prisma = getPrisma(req);
  const { pedidoId } = req.body;

  const result = await pagosService.crearPreferenciaMercadoPagoMock(prisma, pedidoId);
  res.json(result);
};

const crearQrOrdenPresencial = async (req, res) => {
  const prisma = getPrisma(req);
  const result = await pagosService.crearOrdenQrPresencial(prisma, req.body);

  res.status(201).json(result);
};

const verifyWebhookSignature = (req) => {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('MERCADOPAGO_WEBHOOK_SECRET no configurado - webhook rechazado');
    return false;
  }

  const xSignature = req.headers['x-signature'];
  const xRequestId = req.headers['x-request-id'];

  if (!xSignature || !xRequestId) {
    return false;
  }

  const signatureParts = {};
  xSignature.split(',').forEach((part) => {
    const [key, value] = part.split('=');
    signatureParts[key] = value;
  });

  const ts = signatureParts.ts;
  const v1 = signatureParts.v1;

  if (!ts || !v1) {
    return false;
  }

  const dataId = req.query['data.id'] || '';
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(manifest);
  const calculatedSignature = hmac.digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(calculatedSignature),
      Buffer.from(v1)
    );
  } catch {
    return false;
  }
};

const handleQrOrderWebhook = async (prisma, orderId) => {
  const pagoExistente = await prisma.pago.findFirst({
    where: {
      referencia: orderId,
      canalCobro: 'QR_PRESENCIAL'
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!pagoExistente) {
    logger.info('Webhook QR: no se encontro pago local para la orden', { orderId });
    return null;
  }

  let orderInfo;
  try {
    orderInfo = await getQrOrder(orderId);
  } catch (error) {
    logger.error('Webhook QR: error consultando orden en MercadoPago:', error);
    return null;
  }

  const orderStatus = orderInfo.status?.toString().toLowerCase();
  const paymentTx = orderInfo.transactions?.payments?.[0] || null;
  const approved = ['closed', 'processed', 'paid'].includes(orderStatus) || paymentTx?.status === 'approved';

  const updatedPago = await prisma.pago.update({
    where: { id: pagoExistente.id },
    data: {
      estado: approved ? 'APROBADO' : 'PENDIENTE',
      mpPaymentId: paymentTx?.id?.toString() || pagoExistente.mpPaymentId,
      comprobante: orderInfo.qr_data || pagoExistente.comprobante
    }
  });

  let finalized = null;
  if (approved) {
    finalized = await prisma.$transaction(async (tx) => finalizeApprovedPedido(tx, pagoExistente.pedidoId));
  }

  return {
    pedidoId: pagoExistente.pedidoId,
    pago: updatedPago,
    finalized
  };
};

const webhookMercadoPago = async (req, res) => {
  try {
    const prisma = getPrisma(req);
    logger.info('Webhook MercadoPago recibido:', {
      type: req.body.type,
      action: req.body.action,
      dataId: req.query['data.id']
    });

    const shouldVerify = process.env.SKIP_WEBHOOK_VERIFICATION === 'true' && process.env.NODE_ENV !== 'production';
    if (!shouldVerify && !verifyWebhookSignature(req)) {
      logger.error('Webhook MercadoPago: firma invalida o WEBHOOK_SECRET no configurado');
      return res.sendStatus(401);
    }

    const { type, action, data } = req.body;

    if (type === 'order' || action?.startsWith('order.')) {
      const orderId = (data?.id || req.query['data.id'] || '').toString();

      if (!orderId) {
        return res.sendStatus(200);
      }

      const qrResult = await handleQrOrderWebhook(prisma, orderId);

      if (qrResult?.finalized?.pedido) {
        eventBus.publish('pago.updated', {
          pedidoId: qrResult.pedidoId,
          estadoPago: 'APROBADO',
          totalPagado: qrResult.finalized.totalPagado
        });

        publishMesaUpdated(qrResult.finalized.mesaUpdated);
        publishPedidoUpdated(qrResult.finalized.pedido);
      }

      return res.sendStatus(200);
    }

    if (type === 'payment' || action === 'payment.created' || action === 'payment.updated') {
      const paymentId = data?.id || req.query['data.id'];

      if (!paymentId) {
        logger.info('Webhook sin payment ID');
        return res.sendStatus(200);
      }

      const paymentIdStr = paymentId.toString();
      const webhookIdempotencyKey = `mp-payment-${paymentIdStr}`;

      let pagoExistente = await prisma.pago.findFirst({
        where: {
          OR: [
            { mpPaymentId: paymentIdStr },
            { idempotencyKey: webhookIdempotencyKey }
          ]
        },
        orderBy: { createdAt: 'desc' }
      });

      let pedidoId = pagoExistente?.pedidoId;

      let paymentInfo;
      try {
        paymentInfo = await getPayment(paymentIdStr);
      } catch (mpError) {
        logger.error('Error al consultar pago en MercadoPago:', mpError);
        return res.sendStatus(200);
      }

      logger.info('Payment info de MercadoPago:', {
        id: paymentInfo.id,
        status: paymentInfo.status,
        external_reference: paymentInfo.external_reference
      });

      const externalRef = parseExternalReference(paymentInfo.external_reference);
      if (externalRef) {
        const pedido = await prisma.pedido.findUnique({
          where: { id: externalRef.pedidoId },
          select: { id: true }
        });

        if (pedido) {
          pedidoId = externalRef.pedidoId;
        }
      } else if (paymentInfo.external_reference) {
        logger.warn('Webhook: external_reference con formato invalido:', paymentInfo.external_reference);
      }

      if (!pedidoId) {
        logger.info('Webhook: no se pudo determinar pedidoId');
        return res.sendStatus(200);
      }

      if (!pagoExistente) {
        const preferenceId = paymentInfo.preference_id ? paymentInfo.preference_id.toString() : null;

        if (preferenceId) {
          pagoExistente = await prisma.pago.findFirst({
            where: {
              pedidoId,
              metodo: 'MERCADOPAGO',
              mpPreferenceId: preferenceId
            },
            orderBy: { createdAt: 'desc' }
          });
        }

        if (!pagoExistente) {
          pagoExistente = await prisma.pago.findFirst({
            where: {
              pedidoId,
              metodo: 'MERCADOPAGO',
              mpPaymentId: null
            },
            orderBy: { createdAt: 'desc' }
          });
        }
      }

      let estadoPago;
      switch (paymentInfo.status) {
        case 'approved':
          estadoPago = 'APROBADO';
          break;
        case 'rejected':
          estadoPago = 'RECHAZADO';
          break;
        case 'cancelled':
          estadoPago = 'CANCELADO';
          break;
        default:
          estadoPago = 'PENDIENTE';
      }

      let pagoId;
      if (pagoExistente) {
        const pagoActualizado = await prisma.pago.update({
          where: { id: pagoExistente.id },
          data: {
            estado: estadoPago,
            mpPaymentId: paymentIdStr,
            referencia: `MP-${paymentIdStr}`,
            ...(paymentInfo.preference_id
              ? { mpPreferenceId: paymentInfo.preference_id.toString() }
              : {})
          }
        });
        pagoId = pagoActualizado.id;
      } else {
        const nuevoPago = await prisma.pago.create({
          data: {
            pedidoId,
            monto: parseFloat(paymentInfo.transaction_amount),
            metodo: 'MERCADOPAGO',
            canalCobro: 'CHECKOUT_WEB',
            estado: estadoPago,
            mpPaymentId: paymentIdStr,
            referencia: `MP-${paymentIdStr}`,
            ...(paymentInfo.preference_id
              ? { mpPreferenceId: paymentInfo.preference_id.toString() }
              : {}),
            idempotencyKey: webhookIdempotencyKey
          }
        });
        pagoId = nuevoPago.id;
      }

      try {
        await saveTransaction(paymentInfo, pagoId);
      } catch (txError) {
        logger.error('Error al guardar transaccion MP:', txError);
      }

      eventBus.publish('pago.updated', {
        pedidoId,
        estadoPago,
        totalPagado: parseFloat(paymentInfo.transaction_amount)
      });

      if (estadoPago === 'APROBADO') {
        const finalized = await prisma.$transaction(async (tx) => finalizeApprovedPedido(tx, pedidoId));

        if (finalized?.pedido) {
          publishMesaUpdated(finalized.mesaUpdated);
          publishPedidoUpdated(finalized.pedido);

          if (finalized.pedido.clienteEmail) {
            try {
              const negocio = await getNegocio();
              await emailService.sendOrderConfirmation(finalized.pedido, negocio);
              logger.info('Email de confirmacion enviado a:', finalized.pedido.clienteEmail);
            } catch (emailError) {
              logger.error('Error al enviar email:', emailError);
            }
          }
        }
      }
    }

    return res.sendStatus(200);
  } catch (error) {
    logger.error('Error en webhook MercadoPago:', error);
    return res.sendStatus(200);
  }
};

const listarPagosPedido = async (req, res) => {
  const prisma = getPrisma(req);
  const { pedidoId } = req.params;

  const result = await pagosService.listarPagosPedido(prisma, pedidoId);
  res.json(result);
};

module.exports = {
  registrarPago,
  crearPreferenciaMercadoPago,
  crearQrOrdenPresencial,
  webhookMercadoPago,
  listarPagosPedido
};
