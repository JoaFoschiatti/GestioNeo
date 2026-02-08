/**
 * Middleware de verificación de suscripción
 *
 * Verifica si el negocio tiene una suscripción activa.
 * Si no tiene, marca la request como "modo solo lectura".
 *
 * Uso:
 * 1. verificarSuscripcion: Agrega req.modoSoloLectura al request
 * 2. bloquearSiSoloLectura: Bloquea operaciones de escritura si está en modo solo lectura
 *
 * @module suscripcion.middleware
 */

const { prisma } = require('../db/prisma');

/**
 * Verifica si el negocio tiene suscripción activa.
 * Agrega req.modoSoloLectura = true|false según estado de suscripción.
 *
 * NOTA: Este middleware DEBE ejecutarse después de setAuthContext.
 *
 * SUPER_ADMIN siempre tiene acceso completo.
 */
const verificarSuscripcion = async (req, res, next) => {
  try {
    // SUPER_ADMIN siempre tiene acceso completo
    if (req.isSuperAdmin) {
      req.modoSoloLectura = false;
      req.suscripcion = null;
      return next();
    }

    // Buscar suscripción (singleton, id = 1)
    const suscripcion = await prisma.suscripcion.findUnique({
      where: { id: 1 },
      select: {
        id: true,
        estado: true,
        fechaVencimiento: true,
        precioMensual: true
      }
    });

    // Determinar si tiene acceso completo
    const ahora = new Date();
    const tieneAcceso = suscripcion &&
      suscripcion.estado === 'ACTIVA' &&
      suscripcion.fechaVencimiento &&
      suscripcion.fechaVencimiento > ahora;

    req.modoSoloLectura = !tieneAcceso;
    req.suscripcion = suscripcion;

    return next();
  } catch (error) {
    console.error('Error verificando suscripción:', error);
    // En caso de error, permitir acceso para no bloquear al usuario
    req.modoSoloLectura = false;
    req.suscripcion = null;
    return next();
  }
};

/**
 * Bloquea operaciones de escritura si el negocio está en modo solo lectura.
 *
 * DEBE usarse después de verificarSuscripcion.
 *
 * Retorna error 403 con código SUBSCRIPTION_REQUIRED.
 * El frontend puede usar este código para mostrar un CTA de suscripción.
 */
const bloquearSiSoloLectura = (req, res, next) => {
  if (req.modoSoloLectura) {
    return res.status(403).json({
      error: {
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'Tu suscripción no está activa. Solo puedes ver información pero no realizar cambios.',
        action: 'subscribe'
      }
    });
  }
  return next();
};

/**
 * Middleware combinado: verificar suscripción y bloquear si es solo lectura.
 *
 * Uso: Para rutas que requieren suscripción activa para escribir.
 *
 * @example
 * router.post('/', verificarToken, setAuthContext, requiereSuscripcionActiva, controller.crear);
 */
const requiereSuscripcionActiva = [verificarSuscripcion, bloquearSiSoloLectura];

module.exports = {
  verificarSuscripcion,
  bloquearSiSoloLectura,
  requiereSuscripcionActiva
};
