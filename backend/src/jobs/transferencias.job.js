/**
 * Job de sincronización de transferencias con MercadoPago
 * Ejecuta cada 5 minutos para detectar transferencias entrantes
 */

const { prisma } = require('../db/prisma');
const { logger } = require('../utils/logger');
const transferenciasService = require('../services/transferencias.service');

let intervalId = null;
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutos

/**
 * Verifica si las transferencias están habilitadas antes de sincronizar
 */
const isTransferenciasEnabled = async () => {
  try {
    const config = await prisma.mercadoPagoConfig.findUnique({
      where: { id: 1 },
      select: { transferenciasEnabled: true, isActive: true }
    });

    return config?.isActive && config?.transferenciasEnabled;
  } catch (error) {
    return false;
  }
};

/**
 * Sincroniza transferencias desde MercadoPago
 */
const sincronizarTransferencias = async () => {
  try {
    // Verificar si transferencias están habilitadas
    const enabled = await isTransferenciasEnabled();
    if (!enabled) {
      // Silenciosamente no hacer nada si no está habilitado
      return;
    }

    logger.info('🔄 Iniciando sincronización de transferencias...');

    const result = await transferenciasService.syncFromMercadoPago();

    if (result.error) {
      logger.warn('Sincronización de transferencias con advertencia:', result.error);
    } else if (result.nuevas > 0) {
      logger.info(`✅ Sincronización completada: ${result.nuevas} nuevas, ${result.procesadas} procesadas`);
    }
  } catch (error) {
    logger.error('Error en sincronización de transferencias:', error);
  }
};

/**
 * Inicia el job de sincronización (ejecuta cada 5 minutos)
 */
const iniciarJobTransferencias = () => {
  // No ejecutar en tests
  if (process.env.NODE_ENV === 'test') {
    return null;
  }

  // Evitar múltiples instancias
  if (intervalId) {
    return intervalId;
  }

  logger.info('🏦 Job de transferencias iniciado (cada 5 minutos)');

  // Ejecutar después de 30 segundos del inicio (dar tiempo a que arranque el servidor)
  setTimeout(() => {
    sincronizarTransferencias();
  }, 30 * 1000);

  // Ejecutar cada 5 minutos
  intervalId = setInterval(sincronizarTransferencias, SYNC_INTERVAL);

  return intervalId;
};

/**
 * Detiene el job de sincronización
 */
const detenerJobTransferencias = () => {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
  logger.info('🏦 Job de transferencias detenido');
};

module.exports = {
  iniciarJobTransferencias,
  detenerJobTransferencias,
  sincronizarTransferencias
};
