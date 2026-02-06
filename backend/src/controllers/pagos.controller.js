const crypto = require('crypto');
const eventBus = require('../services/event-bus');
const { getPrisma } = require('../utils/get-prisma');
const emailService = require('../services/email.service');
const { getPayment, saveTransaction } = require('../services/mercadopago.service');
const transferenciasService = require('../services/transferencias.service');
const pagosService = require('../services/pagos.service');
const { logger } = require('../utils/logger');

// Registrar pago
const registrarPago = async (req, res) => {
  const prisma = getPrisma(req);
  const { pedidoId, monto, metodo, referencia, comprobante } = req.body;

  const { pago, pedido, totalPagado, pendiente } = await pagosService.registrarPago(prisma, {
    pedidoId,
    monto,
    metodo,
    referencia,
    comprobante
  });

  eventBus.publish('pago.updated', {
    tenantId: 1,
    pedidoId,
    totalPagado,
    pendiente,
    estadoPedido: pedido.estado
  });

  if (pedido.estado === 'COBRADO') {
    eventBus.publish('pedido.updated', {
      tenantId: 1,
      id: pedido.id,
      estado: pedido.estado,
      tipo: pedido.tipo,
      mesaId: pedido.mesaId || null,
      updatedAt: pedido.updatedAt || new Date().toISOString()
    });
  }

  res.status(201).json({
    pago,
    pedido,
    totalPagado,
    pendiente
  });
};

// Crear preferencia de MercadoPago (para delivery)
const crearPreferenciaMercadoPago = async (req, res) => {
  const prisma = getPrisma(req);
  const { pedidoId } = req.body;

  const result = await pagosService.crearPreferenciaMercadoPagoMock(prisma, pedidoId);
  res.json(result);
};

// Verificar firma del webhook de MercadoPago
const verifyWebhookSignature = (req) => {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('MERCADOPAGO_WEBHOOK_SECRET no configurado - webhook rechazado');
    // SECURITY: Never allow webhooks without signature verification
    // In development, signature can be skipped, but secret must still be set
    return false;
  }

  const xSignature = req.headers['x-signature'];
  const xRequestId = req.headers['x-request-id'];

  if (!xSignature || !xRequestId) {
    return false;
  }

  // MercadoPago envía: ts=xxx,v1=xxx
  const signatureParts = {};
  xSignature.split(',').forEach(part => {
    const [key, value] = part.split('=');
    signatureParts[key] = value;
  });

  const ts = signatureParts['ts'];
  const v1 = signatureParts['v1'];

  if (!ts || !v1) {
    return false;
  }

  // Construir el string a firmar
  const dataId = req.query['data.id'] || '';
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  // Calcular HMAC-SHA256
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(manifest);
  const calculatedSignature = hmac.digest('hex');

  // Comparación segura contra timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(calculatedSignature),
      Buffer.from(v1)
    );
  } catch {
    return false;
  }
};

const getPaymentFromGlobalToken = async (paymentId) => {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    return null;
  }

  try {
    const { MercadoPagoConfig, Payment } = require('mercadopago');
    const client = new MercadoPagoConfig({ accessToken });
    const paymentClient = new Payment(client);
    return await paymentClient.get({ id: paymentId });
  } catch (error) {
    logger.error('Error al consultar pago en MercadoPago:', error);
    return null;
  }
};

// Webhook de MercadoPago
const webhookMercadoPago = async (req, res) => {
  try {
    const prisma = getPrisma(req);
    logger.info('Webhook MercadoPago recibido:', {
      type: req.body.type,
      action: req.body.action,
      dataId: req.query['data.id']
    });

    // Verificar firma (SIEMPRE - crítico para seguridad)
    // En desarrollo se puede deshabilitar con SKIP_WEBHOOK_VERIFICATION=true
    const shouldVerify = process.env.NODE_ENV === 'production' || process.env.SKIP_WEBHOOK_VERIFICATION !== 'true';
    if (shouldVerify && !verifyWebhookSignature(req)) {
      logger.error('Webhook MercadoPago: firma inválida o WEBHOOK_SECRET no configurado');
      return res.sendStatus(401);
    }

    const { type, action, data } = req.body;

    // Solo procesar notificaciones de pago
    if (type === 'payment' || action === 'payment.created' || action === 'payment.updated') {
      const paymentId = data?.id || req.query['data.id'];

      if (!paymentId) {
        logger.info('Webhook sin payment ID');
        return res.sendStatus(200);
      }

      const paymentIdStr = paymentId.toString();
      const webhookIdempotencyKey = `mp-payment-${paymentIdStr}`;

      // Buscar pago existente por mpPaymentId o idempotencyKey del webhook
      let pagoExistente = await prisma.pago.findFirst({
        where: {
          OR: [
            { mpPaymentId: paymentIdStr },
            { idempotencyKey: webhookIdempotencyKey }
          ]
        },
        orderBy: { createdAt: 'desc' }
      });

      // Obtener tenantId desde el pago existente o desde external_reference
      let tenantId = pagoExistente?.tenantId;
      let pedidoId = pagoExistente?.pedidoId;

      // Idempotencia: si ya está aprobado y el pedido también, no reprocesar (evita emails/eventos duplicados)
      if (pagoExistente?.estado === 'APROBADO' && pedidoId) {
        const pedidoActual = await prisma.pedido.findUnique({
          where: { id: pedidoId },
          select: { estadoPago: true }
        });
        if (pedidoActual?.estadoPago === 'APROBADO') {
          logger.info('Webhook: pago ya procesado (idempotente)');
          return res.sendStatus(200);
        }
      }

      // Consultar el pago en MercadoPago usando credenciales del tenant
      let paymentInfo;

      if (tenantId) {
        // Usar credenciales del tenant
        try {
          paymentInfo = await getPayment(tenantId, paymentIdStr);
        } catch (mpError) {
          logger.error('Error al consultar pago con credenciales del tenant:', mpError);
          // Fallback: usar credenciales globales si existen
          paymentInfo = await getPaymentFromGlobalToken(paymentIdStr);
          if (!paymentInfo) {
            return res.sendStatus(200);
          }
        }
      } else {
        // No tenemos tenantId, usar credenciales globales como fallback
        paymentInfo = await getPaymentFromGlobalToken(paymentIdStr);
        if (!paymentInfo) {
          logger.error('No hay credenciales para consultar el pago');
          return res.sendStatus(200);
        }
      }

      logger.info('Payment info de MercadoPago:', {
        id: paymentInfo.id,
        status: paymentInfo.status,
        external_reference: paymentInfo.external_reference
      });

      // Parsear external_reference para obtener tenantId y pedidoId
      // Formato esperado: "{tenantId}-{pedidoId}"
      if (paymentInfo.external_reference) {
        // Validar formato estricto con regex
        const EXTERNAL_REF_PATTERN = /^(\d+)-(\d+)$/;
        const match = paymentInfo.external_reference.toString().match(EXTERNAL_REF_PATTERN);

        if (match) {
          const parsedTenantId = parseInt(match[1], 10);
          const parsedPedidoId = parseInt(match[2], 10);

          // Validar que el pedido pertenece al tenant ANTES de procesar
          const pedido = await prisma.pedido.findFirst({
            where: {
              id: parsedPedidoId,
              tenantId: parsedTenantId
            },
            select: { id: true, tenantId: true }
          });

          if (!pedido) {
            logger.warn('Webhook: Pedido no encontrado o tenant incorrecto', {
              tenantId: parsedTenantId,
              pedidoId: parsedPedidoId
            });
            return res.sendStatus(200); // Evitar revelar información
          }

          tenantId = parsedTenantId;
          pedidoId = parsedPedidoId;
        } else {
          // Formato antiguo: solo pedidoId (backward compatibility)
          const parsedPedidoId = parseInt(paymentInfo.external_reference, 10);
          if (!Number.isNaN(parsedPedidoId)) {
            pedidoId = parsedPedidoId;
            // Obtener el tenantId del pedido
            const pedido = await prisma.pedido.findUnique({
              where: { id: parsedPedidoId },
              select: { tenantId: true }
            });
            tenantId = pedido?.tenantId;
          }
        }
      }

      if (!pedidoId) {
        logger.info('Webhook: no se pudo determinar pedidoId');
        return res.sendStatus(200);
      }

      if (!tenantId) {
        logger.info('Webhook: no se pudo determinar tenantId');
        return res.sendStatus(200);
      }

      // Si no encontramos pago por mpPaymentId/idempotencyKey, intentar matchear el pago creado al generar la preferencia
      if (!pagoExistente) {
        const preferenceId = paymentInfo.preference_id ? paymentInfo.preference_id.toString() : null;

        if (preferenceId) {
          pagoExistente = await prisma.pago.findFirst({
            where: {
              tenantId,
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
              tenantId,
              pedidoId,
              metodo: 'MERCADOPAGO',
              mpPaymentId: null
            },
            orderBy: { createdAt: 'desc' }
          });
        }
      }

      // Idempotencia: si ya está aprobado y el pedido también, no reprocesar
      if (pagoExistente?.estado === 'APROBADO') {
        const pedidoActual = await prisma.pedido.findUnique({
          where: { id: pedidoId },
          select: { estadoPago: true }
        });
        if (pedidoActual?.estadoPago === 'APROBADO') {
          logger.info('Webhook: pago ya procesado (idempotente)');
          return res.sendStatus(200);
        }
      }

      // Mapear estado de MercadoPago a nuestro enum
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

      // Actualizar o crear registro de pago
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
            tenantId,
            pedidoId,
            monto: parseFloat(paymentInfo.transaction_amount),
            metodo: 'MERCADOPAGO',
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

      // Guardar transacción en historial de MercadoPago
      if (tenantId) {
        try {
          await saveTransaction(tenantId, paymentInfo, pagoId);
        } catch (txError) {
          logger.error('Error al guardar transacción MP:', txError);
          // No fallar el webhook por esto
        }
      }

      eventBus.publish('pago.updated', {
        tenantId,
        pedidoId,
        estadoPago,
        totalPagado: parseFloat(paymentInfo.transaction_amount)
      });

      // Si el pago fue aprobado, actualizar pedido
      if (estadoPago === 'APROBADO') {
        const pedido = await prisma.pedido.update({
          where: { id: pedidoId },
          data: { estadoPago: 'APROBADO' },
          include: {
            items: { include: { producto: true } },
            tenant: true
          }
        });

        eventBus.publish('pedido.updated', {
          tenantId,
          id: pedido.id,
          estado: pedido.estado,
          estadoPago: pedido.estadoPago,
          tipo: pedido.tipo,
          mesaId: pedido.mesaId || null,
          updatedAt: pedido.updatedAt || new Date().toISOString()
        });

        // Enviar email de confirmación
        if (pedido.clienteEmail) {
          try {
            await emailService.sendOrderConfirmation(pedido, pedido.tenant);
            logger.info('Email de confirmación enviado a:', pedido.clienteEmail);
          } catch (emailError) {
            logger.error('Error al enviar email:', emailError);
            // No fallar el webhook por error de email
          }
        }
      }
    }

    res.sendStatus(200);
  } catch (error) {
    logger.error('Error en webhook MercadoPago:', error);
    // Siempre responder 200 para evitar reintentos infinitos
    res.sendStatus(200);
  }
};

// Listar pagos de un pedido
const listarPagosPedido = async (req, res) => {
  const prisma = getPrisma(req);
  const { pedidoId } = req.params;

  const result = await pagosService.listarPagosPedido(prisma, pedidoId);
  res.json(result);
};

// Webhook de MercadoPago para movimientos de cuenta (transferencias)
const webhookMercadoPagoMovements = async (req, res) => {
  try {
    logger.info('Webhook MercadoPago Movements recibido:', {
      type: req.body.type,
      topic: req.body.topic,
      action: req.body.action,
      dataId: req.query['data.id']
    });

    // Verificar firma (igual que pagos)
    const shouldVerify = process.env.NODE_ENV === 'production' || process.env.SKIP_WEBHOOK_VERIFICATION !== 'true';
    if (shouldVerify && !verifyWebhookSignature(req)) {
      logger.error('Webhook Movements: firma inválida o WEBHOOK_SECRET no configurado');
      return res.sendStatus(401);
    }

    const { type, topic, action, data } = req.body;

    // Procesar notificaciones de transferencias/movimientos
    // Topics: money_transfer_received, account_money_received
    // Types: account.movement, transfer
    const isTransferEvent =
      topic === 'money_transfer_received' ||
      topic === 'account_money_received' ||
      type === 'account.movement' ||
      type === 'transfer' ||
      action === 'money_transfer.received';

    if (!isTransferEvent) {
      logger.info('Webhook Movements: evento no es transferencia, ignorando');
      return res.sendStatus(200);
    }

    const movementId = data?.id || req.query['data.id'];

    if (!movementId) {
      logger.info('Webhook Movements: sin movement ID');
      return res.sendStatus(200);
    }

    // Obtener detalles del movimiento desde MercadoPago
    let movementData;
    try {
      movementData = await transferenciasService.getMovementDetails(movementId.toString());
    } catch (error) {
      logger.error('Error obteniendo detalles del movimiento:', error);
      // No podemos procesar sin los datos, pero respondemos 200 para evitar reintentos
      return res.sendStatus(200);
    }

    // Procesar la transferencia entrante
    const transferencia = await transferenciasService.processIncomingTransfer(movementData);

    logger.info('Transferencia procesada:', {
      id: transferencia.id,
      mpMovementId: transferencia.mpMovementId,
      amount: transferencia.amount,
      estado: transferencia.estado,
      pedidoId: transferencia.pedidoId
    });

    res.sendStatus(200);
  } catch (error) {
    logger.error('Error en webhook MercadoPago Movements:', error);
    // Siempre responder 200 para evitar reintentos infinitos
    res.sendStatus(200);
  }
};

module.exports = {
  registrarPago,
  crearPreferenciaMercadoPago,
  webhookMercadoPago,
  webhookMercadoPagoMovements,
  listarPagosPedido
};
