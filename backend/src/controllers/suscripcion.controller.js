/**
 * Controlador de Suscripciones
 */

const crypto = require('crypto');
const suscripcionService = require('../services/suscripcion.service');

/**
 * POST /api/suscripcion/crear
 * Crea una nueva suscripción en MercadoPago
 */
const crearSuscripcion = async (req, res) => {
  const resultado = await suscripcionService.crearSuscripcion();

  res.json({
    success: true,
    initPoint: resultado.initPoint,
    sandboxInitPoint: resultado.sandboxInitPoint,
    suscripcion: {
      id: resultado.suscripcion.id,
      estado: resultado.suscripcion.estado
    }
  });
};

/**
 * GET /api/suscripcion/estado
 * Obtiene el estado actual de la suscripción
 */
const obtenerEstado = async (req, res) => {
  const estado = await suscripcionService.obtenerEstado();
  res.json(estado);
};

/**
 * POST /api/suscripcion/cancelar
 * Cancela la suscripción activa
 */
const cancelarSuscripcion = async (req, res) => {
  const suscripcion = await suscripcionService.cancelarSuscripcion();

  res.json({
    success: true,
    message: 'Suscripción cancelada correctamente',
    suscripcion: {
      id: suscripcion.id,
      estado: suscripcion.estado
    }
  });
};

/**
 * GET /api/suscripcion/pagos
 * Obtiene el historial de pagos de la suscripción
 */
const obtenerPagos = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const resultado = await suscripcionService.obtenerHistorialPagos({
    page: parseInt(page),
    limit: parseInt(limit)
  });

  res.json(resultado);
};

/**
 * POST /api/suscripcion/webhook
 * Webhook de MercadoPago para notificaciones de suscripción
 */
const webhookSuscripcion = async (req, res) => {
  // Siempre responder 200 para que MP no reintente indefinidamente
  const responder200 = () => {
    if (!res.headersSent) {
      res.sendStatus(200);
    }
  };

  try {
    // Verificar firma si está configurada
    const webhookSecret = process.env.MP_SUBSCRIPTION_WEBHOOK_SECRET;

    if (webhookSecret && process.env.NODE_ENV === 'production') {
      const xSignature = req.headers['x-signature'];
      const xRequestId = req.headers['x-request-id'];

      if (!xSignature) {
        console.warn('Webhook de suscripción sin firma');
        return responder200();
      }

      // Parsear firma
      const signatureParts = xSignature.split(',').reduce((acc, part) => {
        const [key, value] = part.split('=');
        if (key && value) acc[key.trim()] = value.trim();
        return acc;
      }, {});

      const ts = signatureParts.ts;
      const v1 = signatureParts.v1;

      if (!ts || !v1) {
        console.warn('Webhook de suscripción: firma incompleta');
        return responder200();
      }

      // Construir manifest
      const dataId = req.body.data?.id || req.query['data.id'];
      let manifest = '';
      if (dataId) manifest += `id:${dataId};`;
      if (xRequestId) manifest += `request-id:${xRequestId};`;
      manifest += `ts:${ts};`;

      // Calcular HMAC
      const hmac = crypto
        .createHmac('sha256', webhookSecret)
        .update(manifest)
        .digest('hex');

      // Comparación segura
      try {
        const expected = Buffer.from(v1, 'hex');
        const actual = Buffer.from(hmac, 'hex');

        if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
          console.warn('Webhook de suscripción: firma inválida');
          return responder200();
        }
      } catch (err) {
        console.warn('Webhook de suscripción: error verificando firma', err);
        return responder200();
      }
    }

    const { type, data } = req.body;

    if (!type || !data?.id) {
      console.warn('Webhook de suscripción: payload incompleto', req.body);
      return responder200();
    }

    // Tipos de notificación soportados
    const tiposSoportados = [
      'subscription_preapproval',
      'subscription_authorized_payment'
    ];

    if (!tiposSoportados.includes(type)) {
      // Tipo no soportado, ignorar
      return responder200();
    }

    // Procesar en background para responder rápido
    setImmediate(async () => {
      try {
        await suscripcionService.procesarWebhook(type, data.id);
      } catch (error) {
        console.error('Error procesando webhook de suscripción:', error);
      }
    });

    responder200();
  } catch (error) {
    console.error('Error en webhook de suscripción:', error);
    responder200();
  }
};

module.exports = {
  crearSuscripcion,
  obtenerEstado,
  cancelarSuscripcion,
  obtenerPagos,
  webhookSuscripcion
};
