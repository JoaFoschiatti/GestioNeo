const app = require('./app');
const { prisma } = require('./db/prisma');
const { iniciarJobReservas, detenerJobReservas } = require('./jobs/reservas.job');

const PORT = process.env.PORT || 3001;

let server;
let shuttingDown = false;

const start = () => {
  server = app.listen(PORT, () => {
    console.log(`🚀 GestioNeo API corriendo en http://localhost:${PORT}`);
    console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);

    iniciarJobReservas();
  });
};

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n🛑 Recibido ${signal}. Cerrando...`);

  try {
    detenerJobReservas();
  } catch (e) {
    console.error('Error deteniendo job de reservas:', e);
  }

  await new Promise((resolve) => {
    if (!server) return resolve();
    server.close(() => resolve());
  });

  try {
    await prisma.$disconnect();
  } catch (e) {
    console.error('Error desconectando Prisma:', e);
  }

  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
