/**
 * Middleware de contexto de aplicación.
 *
 * Este archivo provee middlewares para:
 * - Agregar el cliente Prisma al request
 * - Verificar el estado de la suscripción
 * - Bloquear operaciones de escritura si no hay suscripción activa
 *
 * @module tenant.middleware
 */

const { prisma } = require('../db/prisma');

/**
 * Establece el contexto de la aplicación.
 *
 * IMPORTANTE: Debe usarse DESPUÉS de `verificarToken`.
 *
 * Agrega al request:
 * - req.prisma: Cliente Prisma
 * - req.suscripcion: Estado de la suscripción
 * - req.modoSoloLectura: true si no hay suscripción activa
 *
 * @param {import('express').Request} req - Request con req.usuario (de verificarToken)
 * @param {import('express').Response} res - Response de Express
 * @param {import('express').NextFunction} next - Siguiente middleware
 *
 * @example
 * // En routes/productos.routes.js
 * router.get('/',
 *   verificarToken,     // Primero: valida JWT, agrega req.usuario
 *   setAuthContext,     // Segundo: agrega req.prisma y verifica suscripción
 *   controller.listar
 * );
 */
const setAuthContext = async (req, res, next) => {
  try {
    // Agregar prisma al request
    req.prisma = prisma;

    // Verificar estado de suscripción
    try {
      const suscripcion = await prisma.suscripcion.findUnique({
        where: { id: 1 }, // Singleton
        select: { id: true, estado: true, fechaVencimiento: true, precioMensual: true }
      });

      const ahora = new Date();
      const tieneAcceso = suscripcion &&
        suscripcion.estado === 'ACTIVA' &&
        suscripcion.fechaVencimiento &&
        suscripcion.fechaVencimiento > ahora;

      req.modoSoloLectura = !tieneAcceso;
      req.suscripcion = suscripcion;
    } catch (suscripcionError) {
      console.error('Error verificando suscripcion:', suscripcionError);
      req.modoSoloLectura = true;
      req.suscripcion = null;
    }

    return next();
  } catch (error) {
    console.error('Error estableciendo contexto:', error);
    return res.status(500).json({
      error: { message: 'Error interno del servidor' }
    });
  }
};

/**
 * Establece el contexto para rutas públicas (sin autenticación).
 *
 * Agrega al request:
 * - req.prisma: Cliente Prisma
 *
 * @param {import('express').Request} req - Request de Express
 * @param {import('express').Response} res - Response de Express
 * @param {import('express').NextFunction} next - Siguiente middleware
 */
const setPublicContext = (req, res, next) => {
  req.prisma = prisma;
  return next();
};

/**
 * Bloquea operaciones de escritura si no hay suscripción activa.
 *
 * DEBE usarse después de setAuthContext.
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

module.exports = {
  setAuthContext,
  setPublicContext,
  bloquearSiSoloLectura
};
