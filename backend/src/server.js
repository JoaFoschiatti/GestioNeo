const app = require('./app');
const { prisma } = require('./db/prisma');
const { logger } = require('./utils/logger');
const { iniciarJobReservas, detenerJobReservas } = require('./jobs/reservas.job');
const { iniciarJobTransferencias, detenerJobTransferencias } = require('./jobs/transferencias.job');
const { iniciarJobCotizacion, detenerJobCotizacion } = require('./jobs/cotizacion.job');

const PORT = process.env.PORT || 3001;

// Validar secrets críticos
const PLACEHOLDER_SECRETS = {
  JWT_SECRET: 'CHANGE_THIS_SECRET_IN_PRODUCTION_MIN_32_CHARS',
  ENCRYPTION_KEY: '0000000000000000000000000000000000000000000000000000000000000000',
  BRIDGE_TOKEN: 'CHANGE_THIS_BRIDGE_TOKEN_IN_PRODUCTION'
};

const insecureSecrets = Object.entries(PLACEHOLDER_SECRETS)
  .filter(([key, placeholder]) => process.env[key] === placeholder || !process.env[key])
  .map(([key]) => key);

if (insecureSecrets.length > 0) {
  const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  if (isDev) {
    logger.warn(`⚠ Secrets con valores placeholder o no configurados: ${insecureSecrets.join(', ')}. Configurar antes de deployar.`);
  } else {
    logger.error(`FATAL: Los siguientes secrets tienen valores placeholder o no están configurados: ${insecureSecrets.join(', ')}. No se puede arrancar en producción.`);
    process.exit(1);
  }
}

let server;
let shuttingDown = false;

const start = () => {
  server = app.listen(PORT, () => {
    logger.info(`🚀 Comanda API corriendo en http://localhost:${PORT}`, {
      port: PORT,
      environment: process.env.NODE_ENV || 'development'
    });

    iniciarJobReservas();
    iniciarJobTransferencias();
    iniciarJobCotizacion();
  });
};

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`Recibido ${signal}. Cerrando servidor...`, { signal });

  try {
    detenerJobReservas();
  } catch (e) {
    logger.error('Error deteniendo job de reservas', e);
  }

  try {
    detenerJobTransferencias();
  } catch (e) {
    logger.error('Error deteniendo job de transferencias', e);
  }

  try {
    detenerJobCotizacion();
  } catch (e) {
    logger.error('Error deteniendo job de cotización', e);
  }

  await new Promise((resolve) => {
    if (!server) return resolve();
    server.close(() => resolve());
  });

  try {
    await prisma.$disconnect();
    logger.info('Prisma desconectado correctamente');
  } catch (e) {
    logger.error('Error desconectando Prisma', e);
  }

  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
