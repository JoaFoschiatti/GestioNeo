const eventBus = require('../services/event-bus');
const { prisma } = require('../db/prisma');
const { logger } = require('../utils/logger');

let intervalId = null;

const procesarReservas = async () => {
  try {
    const ahora = new Date();
    const en15Min = new Date(ahora.getTime() + 15 * 60 * 1000);

    const reservasProximas = await prisma.reserva.findMany({
      where: {
        estado: 'CONFIRMADA',
        fechaHora: { gte: ahora, lte: en15Min }
      },
      include: { mesa: true }
    });

    for (const reserva of reservasProximas) {
      if (reserva.mesa.estado === 'LIBRE') {
        await prisma.$transaction(async (tx) => {
          await tx.mesa.update({
            where: { id: reserva.mesaId },
            data: { estado: 'RESERVADA' }
          });
        });

        eventBus.publish('mesa.updated', {
          mesaId: reserva.mesaId,
          estado: 'RESERVADA',
          reservaId: reserva.id,
          updatedAt: new Date().toISOString()
        });

        logger.info(`Mesa ${reserva.mesa.numero} marcada como RESERVADA para reserva #${reserva.id}`);
      }
    }

    const hace30Min = new Date(ahora.getTime() - 30 * 60 * 1000);

    const reservasVencidas = await prisma.reserva.findMany({
      where: {
        estado: 'CONFIRMADA',
        fechaHora: { lt: hace30Min }
      },
      include: { mesa: true }
    });

    for (const reserva of reservasVencidas) {
      const mesaLiberada = await prisma.$transaction(async (tx) => {
        await tx.reserva.update({
          where: { id: reserva.id },
          data: { estado: 'NO_LLEGO' }
        });

        if (reserva.mesa.estado === 'RESERVADA') {
          await tx.mesa.update({
            where: { id: reserva.mesaId },
            data: { estado: 'LIBRE' }
          });
          return true;
        }
        return false;
      });

      if (mesaLiberada) {
        eventBus.publish('mesa.updated', {
          mesaId: reserva.mesaId,
          estado: 'LIBRE',
          updatedAt: new Date().toISOString()
        });
      }

      eventBus.publish('reserva.updated', {
        id: reserva.id,
        estado: 'NO_LLEGO',
        mesaId: reserva.mesaId
      });

      logger.info(`Reserva #${reserva.id} marcada como NO_LLEGO (cliente no llego)`);
    }
  } catch (error) {
    logger.error('Error procesando reservas:', error);
  }
};

const iniciarJobReservas = () => {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }

  if (intervalId) {
    return intervalId;
  }

  logger.info('Job de reservas iniciado');
  procesarReservas();
  intervalId = setInterval(procesarReservas, 60 * 1000);
  return intervalId;
};

const detenerJobReservas = () => {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
};

module.exports = { iniciarJobReservas, detenerJobReservas, procesarReservas };
