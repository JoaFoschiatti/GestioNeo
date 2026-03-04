/**
 * Job de actualización de cotización USD/ARS (dólar blue)
 * Obtiene la cotización desde dolarapi.com y la guarda en Configuracion
 */

const { prisma } = require('../db/prisma');
const { logger } = require('../utils/logger');

let intervalId = null;
const UPDATE_HOURS = parseInt(process.env.COTIZACION_UPDATE_HOURS || '24', 10);
const UPDATE_INTERVAL = UPDATE_HOURS * 60 * 60 * 1000;

/**
 * Obtiene la cotización del dólar blue y la guarda en la DB
 */
const actualizarCotizacion = async () => {
  try {
    const response = await fetch('https://dolarapi.com/v1/dolares/blue');

    if (!response.ok) {
      logger.warn(`Cotización: API respondió ${response.status}`);
      return;
    }

    const data = await response.json();
    const venta = data.venta;

    if (!venta || venta <= 0) {
      logger.warn('Cotización: valor de venta inválido', { data });
      return;
    }

    const now = new Date().toISOString();

    await prisma.$transaction([
      prisma.configuracion.upsert({
        where: { clave: 'cotizacion_usd_ars' },
        update: { valor: String(venta) },
        create: { clave: 'cotizacion_usd_ars', valor: String(venta) }
      }),
      prisma.configuracion.upsert({
        where: { clave: 'cotizacion_updated_at' },
        update: { valor: now },
        create: { clave: 'cotizacion_updated_at', valor: now }
      })
    ]);

    logger.info(`Cotización USD/ARS actualizada: $${venta} (blue)`);
  } catch (error) {
    logger.warn('Error actualizando cotización USD/ARS:', error.message);
  }
};

/**
 * Inicia el job de actualización de cotización
 */
const iniciarJobCotizacion = () => {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }

  if (intervalId) {
    return intervalId;
  }

  logger.info(`💱 Job de cotización iniciado (cada ${UPDATE_HOURS}h)`);

  // Ejecutar inmediatamente al iniciar
  actualizarCotizacion();

  // Ejecutar periódicamente
  intervalId = setInterval(actualizarCotizacion, UPDATE_INTERVAL);

  return intervalId;
};

/**
 * Detiene el job de actualización de cotización
 */
const detenerJobCotizacion = () => {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
  logger.info('💱 Job de cotización detenido');
};

module.exports = {
  iniciarJobCotizacion,
  detenerJobCotizacion,
  actualizarCotizacion
};
