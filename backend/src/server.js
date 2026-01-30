const app = require('./app');
const { prisma } = require('./db/prisma');
const { logger } = require('./utils/logger');
const { iniciarJobReservas, detenerJobReservas } = require('./jobs/reservas.job');

const PORT = process.env.PORT || 3001;

let server;
let shuttingDown = false;

const start = () => {
  server = app.listen(PORT, () => {
    logger.info(`🚀 Comanda API corriendo en http://localhost:${PORT}`, {
      port: PORT,
      environment: process.env.NODE_ENV || 'development'
    });

    iniciarJobReservas();
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
