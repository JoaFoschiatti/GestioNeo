const app = require('./app');
const { prisma } = require('./db/prisma');
const { logger } = require('./utils/logger');
const { iniciarJobReservas, detenerJobReservas } = require('./jobs/reservas.job');
const { iniciarJobTransferencias, detenerJobTransferencias } = require('./jobs/transferencias.job');

const PORT = process.env.PORT || 3001;

// Validar secrets críticos en producción
if (process.env.NODE_ENV === 'production') {
  const PLACEHOLDER_SECRETS = {
    JWT_SECRET: 'CHANGE_THIS_SECRET_IN_PRODUCTION_MIN_32_CHARS',
    ENCRYPTION_KEY: '0000000000000000000000000000000000000000000000000000000000000000',
    BRIDGE_TOKEN: 'CHANGE_THIS_BRIDGE_TOKEN_IN_PRODUCTION'
  };

  const insecure = Object.entries(PLACEHOLDER_SECRETS)
    .filter(([key, placeholder]) => process.env[key] === placeholder || !process.env[key])
    .map(([key]) => key);

  if (insecure.length > 0) {
    logger.error(`FATAL: Los siguientes secrets tienen valores placeholder o no están configurados: ${insecure.join(', ')}. No se puede arrancar en producción.`);
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
