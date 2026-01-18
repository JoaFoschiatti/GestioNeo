const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();
const emailService = require('../services/email.service');

// Registrar pago
const registrarPago = async (req, res) => {
  try {
    const { pedidoId, monto, metodo, referencia, comprobante } = req.body;

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { pagos: true }
    });

    if (!pedido) {
      return res.status(404).json({ error: { message: 'Pedido no encontrado' } });
    }

    if (pedido.estado === 'CANCELADO') {
      return res.status(400).json({ error: { message: 'No se puede pagar un pedido cancelado' } });
    }

    // Calcular total pagado
    const totalPagado = pedido.pagos.reduce((sum, p) => sum + parseFloat(p.monto), 0);
    const pendiente = parseFloat(pedido.total) - totalPagado;

    if (parseFloat(monto) > pendiente + 0.01) { // pequeño margen para decimales
      return res.status(400).json({
        error: { message: `El monto excede el pendiente ($${pendiente.toFixed(2)})` }
      });
    }

    const pago = await prisma.pago.create({
      data: { pedidoId, monto, metodo, referencia, comprobante }
    });

    // Si el total pagado cubre el pedido, marcarlo como cobrado
    const nuevoTotalPagado = totalPagado + parseFloat(monto);
    if (nuevoTotalPagado >= parseFloat(pedido.total) - 0.01) {
      await prisma.pedido.update({
        where: { id: pedidoId },
        data: { estado: 'COBRADO' }
      });

      // Liberar mesa si aplica
      if (pedido.mesaId) {
        await prisma.mesa.update({
          where: { id: pedido.mesaId },
          data: { estado: 'LIBRE' }
        });
      }
    }

    const pedidoActualizado = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { pagos: true, mesa: true }
    });

    res.status(201).json({
      pago,
      pedido: pedidoActualizado,
      totalPagado: nuevoTotalPagado,
      pendiente: Math.max(0, parseFloat(pedido.total) - nuevoTotalPagado)
    });
  } catch (error) {
    console.error('Error al registrar pago:', error);
    res.status(500).json({ error: { message: 'Error al registrar pago' } });
  }
};

// Crear preferencia de MercadoPago (para delivery)
const crearPreferenciaMercadoPago = async (req, res) => {
  try {
    const { pedidoId } = req.body;

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { items: { include: { producto: true } } }
    });

    if (!pedido) {
      return res.status(404).json({ error: { message: 'Pedido no encontrado' } });
    }

    // TODO: Integrar SDK de MercadoPago real
    // Por ahora retornamos un mock para desarrollo
    const preferencia = {
      id: `PREF_${pedidoId}_${Date.now()}`,
      init_point: `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=MOCK_${pedidoId}`,
      sandbox_init_point: `https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=MOCK_${pedidoId}`
    };

    res.json({
      preferencia,
      message: 'Para integración real, configurar MERCADOPAGO_ACCESS_TOKEN en .env'
    });
  } catch (error) {
    console.error('Error al crear preferencia:', error);
    res.status(500).json({ error: { message: 'Error al crear preferencia de pago' } });
  }
};

// Verificar firma del webhook de MercadoPago
const verifyWebhookSignature = (req) => {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('MERCADOPAGO_WEBHOOK_SECRET no configurado - webhook sin verificar');
    return true; // En sandbox sin secret configurado, permitir
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

// Webhook de MercadoPago
const webhookMercadoPago = async (req, res) => {
  try {
    console.log('Webhook MercadoPago recibido:', {
      type: req.body.type,
      action: req.body.action,
      dataId: req.query['data.id']
    });

    // Verificar firma (en producción es crítico)
    if (process.env.NODE_ENV === 'production' && !verifyWebhookSignature(req)) {
      console.error('Webhook MercadoPago: firma inválida');
      return res.sendStatus(401);
    }

    const { type, action, data } = req.body;

    // Solo procesar notificaciones de pago
    if (type === 'payment' || action === 'payment.created' || action === 'payment.updated') {
      const paymentId = data?.id || req.query['data.id'];

      if (!paymentId) {
        console.log('Webhook sin payment ID');
        return res.sendStatus(200);
      }

      // IMPORTANTE: Consultar a MercadoPago para verificar el pago real
      // No confiar en el body del webhook
      const { MercadoPagoConfig, Payment } = require('mercadopago');
      const client = new MercadoPagoConfig({
        accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
      });
      const paymentClient = new Payment(client);

      let paymentInfo;
      try {
        paymentInfo = await paymentClient.get({ id: paymentId });
      } catch (mpError) {
        console.error('Error al consultar pago en MercadoPago:', mpError);
        return res.sendStatus(200); // Responder OK para que no reintente
      }

      console.log('Payment info de MercadoPago:', {
        id: paymentInfo.id,
        status: paymentInfo.status,
        external_reference: paymentInfo.external_reference
      });

      // Obtener pedido desde external_reference
      const pedidoId = parseInt(paymentInfo.external_reference);
      if (!pedidoId) {
        console.log('Webhook: external_reference no válido');
        return res.sendStatus(200);
      }

      // Buscar pago existente por idempotencyKey para evitar duplicados
      const idempotencyKey = `mp-payment-${paymentId}`;
      const pagoExistente = await prisma.pago.findFirst({
        where: { idempotencyKey }
      });

      if (pagoExistente && pagoExistente.estado === 'APROBADO') {
        console.log('Webhook: pago ya procesado (idempotente)');
        return res.sendStatus(200);
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
      if (pagoExistente) {
        await prisma.pago.update({
          where: { id: pagoExistente.id },
          data: {
            estado: estadoPago,
            mpPaymentId: paymentId.toString(),
            referencia: `MP-${paymentId}`
          }
        });
      } else {
        await prisma.pago.create({
          data: {
            pedidoId,
            monto: parseFloat(paymentInfo.transaction_amount),
            metodo: 'MERCADOPAGO',
            estado: estadoPago,
            mpPaymentId: paymentId.toString(),
            referencia: `MP-${paymentId}`,
            idempotencyKey
          }
        });
      }

      // Si el pago fue aprobado, actualizar pedido
      if (estadoPago === 'APROBADO') {
        const pedido = await prisma.pedido.update({
          where: { id: pedidoId },
          data: { estadoPago: 'APROBADO' },
          include: {
            items: { include: { producto: true } }
          }
        });

        // Enviar email de confirmación
        if (pedido.clienteEmail) {
          try {
            await emailService.sendOrderConfirmation(pedido);
            console.log('Email de confirmación enviado a:', pedido.clienteEmail);
          } catch (emailError) {
            console.error('Error al enviar email:', emailError);
            // No fallar el webhook por error de email
          }
        }
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error en webhook MercadoPago:', error);
    // Siempre responder 200 para evitar reintentos infinitos
    res.sendStatus(200);
  }
};

// Listar pagos de un pedido
const listarPagosPedido = async (req, res) => {
  try {
    const { pedidoId } = req.params;

    const pagos = await prisma.pago.findMany({
      where: { pedidoId: parseInt(pedidoId) },
      orderBy: { createdAt: 'desc' }
    });

    const pedido = await prisma.pedido.findUnique({
      where: { id: parseInt(pedidoId) },
      select: { total: true }
    });

    const totalPagado = pagos.reduce((sum, p) => sum + parseFloat(p.monto), 0);

    res.json({
      pagos,
      totalPedido: pedido?.total || 0,
      totalPagado,
      pendiente: Math.max(0, parseFloat(pedido?.total || 0) - totalPagado)
    });
  } catch (error) {
    console.error('Error al listar pagos:', error);
    res.status(500).json({ error: { message: 'Error al obtener pagos' } });
  }
};

module.exports = {
  registrarPago,
  crearPreferenciaMercadoPago,
  webhookMercadoPago,
  listarPagosPedido
};
