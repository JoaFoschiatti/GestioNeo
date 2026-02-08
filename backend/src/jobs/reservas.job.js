const eventBus = require('../services/event-bus');
const { prisma } = require('../db/prisma');
const { logger } = require('../utils/logger');

let intervalId = null;

// Procesar reservas cada minuto
const procesarReservas = async () => {
  try {
    const ahora = new Date();

    // 1. Marcar mesas como RESERVADA 15 minutos antes de la reserva
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
        await prisma.mesa.update({
          where: { id: reserva.mesaId },
          data: { estado: 'RESERVADA' }
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

    // 2. Marcar reservas como NO_LLEGO si pasaron 30 minutos sin que llegue el cliente
    const hace30Min = new Date(ahora.getTime() - 30 * 60 * 1000);

    const reservasVencidas = await prisma.reserva.findMany({
      where: {
        estado: 'CONFIRMADA',
        fechaHora: { lt: hace30Min }
      },
      include: { mesa: true }
    });

    for (const reserva of reservasVencidas) {
      await prisma.reserva.update({
        where: { id: reserva.id },
        data: { estado: 'NO_LLEGO' }
      });

      // Liberar la mesa si estaba RESERVADA
      if (reserva.mesa.estado === 'RESERVADA') {
        await prisma.mesa.update({
          where: { id: reserva.mesaId },
          data: { estado: 'LIBRE' }
        });

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

      logger.info(`Reserva #${reserva.id} marcada como NO_LLEGO (cliente no llegó)`);
    }
  } catch (error) {
    logger.error('Error procesando reservas:', error);
  }
};

// Iniciar el job (ejecutar cada minuto)
const iniciarJobReservas = () => {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }

  if (intervalId) {
    return intervalId;
  }

  logger.info('🗓️  Job de reservas iniciado');

  // Ejecutar inmediatamente al iniciar
  procesarReservas();

  // Ejecutar cada minuto
  intervalId = setInterval(procesarReservas, 60 * 1000);
  return intervalId;
};

const detenerJobReservas = () => {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
};

module.exports = { iniciarJobReservas, detenerJobReservas, procesarReservas };
