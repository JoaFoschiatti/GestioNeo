const { createHttpError } = require('../utils/http-error');

const buildDayRange = (fecha) => {
  const inicio = new Date(`${fecha}T00:00:00`);
  const finExclusive = new Date(`${fecha}T00:00:00`);
  finExclusive.setDate(finExclusive.getDate() + 1);
  return { gte: inicio, lt: finExclusive };
};

const listar = async (prisma, query) => {
  const { fecha, mesaId, estado } = query;

  const where = {};

  if (fecha) {
    where.fechaHora = buildDayRange(fecha);
  }

  if (mesaId) where.mesaId = mesaId;
  if (estado) where.estado = estado;

  return prisma.reserva.findMany({
    where,
    include: {
      mesa: { select: { numero: true, zona: true, capacidad: true } }
    },
    orderBy: { fechaHora: 'asc' }
  });
};

const reservasProximas = async (prisma) => {
  const ahora = new Date();
  const en30Min = new Date(ahora.getTime() + 30 * 60 * 1000);

  return prisma.reserva.findMany({
    where: {
      estado: 'CONFIRMADA',
      fechaHora: { gte: ahora, lte: en30Min }
    },
    include: {
      mesa: { select: { id: true, numero: true, zona: true } }
    },
    orderBy: { fechaHora: 'asc' }
  });
};

const obtener = async (prisma, id) => {
  const reserva = await prisma.reserva.findUnique({
    where: { id },
    include: {
      mesa: { select: { numero: true, zona: true, capacidad: true } }
    }
  });

  if (!reserva) {
    throw createHttpError.notFound('Reserva no encontrada');
  }

  return reserva;
};

const crear = async (prisma, data) => {
  const { mesaId, cantidadPersonas, fechaHora } = data;

  const { reserva } = await prisma.$transaction(async (tx) => {
    const mesa = await tx.mesa.findUnique({ where: { id: mesaId } });
    if (!mesa) {
      throw createHttpError.notFound('Mesa no encontrada');
    }

    if (cantidadPersonas > mesa.capacidad) {
      throw createHttpError.badRequest(`La mesa ${mesa.numero} tiene capacidad para ${mesa.capacidad} personas`);
    }

    const dosHoras = 2 * 60 * 60 * 1000;
    const rangoInicio = new Date(fechaHora.getTime() - dosHoras);
    const rangoFin = new Date(fechaHora.getTime() + dosHoras);

    const conflicto = await tx.reserva.findFirst({
      where: {
        mesaId,
        estado: { in: ['CONFIRMADA', 'CLIENTE_PRESENTE'] },
        fechaHora: { gte: rangoInicio, lte: rangoFin }
      },
      select: { id: true }
    });

    if (conflicto) {
      throw createHttpError.badRequest('Ya existe una reserva para esta mesa cercana a esa hora');
    }

    const created = await tx.reserva.create({
      data,
      include: {
        mesa: { select: { numero: true, zona: true } }
      }
    });

    return { reserva: created };
  });

  const events = [
    {
      topic: 'reserva.created',
      payload: {
        id: reserva.id,
        mesaId: reserva.mesaId,
        fechaHora: reserva.fechaHora,
        clienteNombre: reserva.clienteNombre
      }
    }
  ];

  return { reserva, events };
};

const actualizar = async (prisma, id, data) => {
  const reserva = await prisma.reserva.findUnique({
    where: { id },
    include: { mesa: true }
  });

  if (!reserva) {
    throw createHttpError.notFound('Reserva no encontrada');
  }

  if (reserva.estado !== 'CONFIRMADA') {
    throw createHttpError.badRequest('Solo se pueden modificar reservas confirmadas');
  }

  if (data.cantidadPersonas !== undefined && data.cantidadPersonas > reserva.mesa.capacidad) {
    throw createHttpError.badRequest(`La mesa ${reserva.mesa.numero} tiene capacidad para ${reserva.mesa.capacidad} personas`);
  }

  return prisma.reserva.update({
    where: { id },
    data,
    include: {
      mesa: { select: { numero: true, zona: true } }
    }
  });
};

const cambiarEstado = async (prisma, id, estado) => {
  const { reservaActualizada, mesaUpdated } = await prisma.$transaction(async (tx) => {
    const reserva = await tx.reserva.findUnique({
      where: { id },
      include: { mesa: true }
    });

    if (!reserva) {
      throw createHttpError.notFound('Reserva no encontrada');
    }

    let mesaUpdatedEvent = null;

    if (estado === 'CLIENTE_PRESENTE' && reserva.mesa.estado === 'RESERVADA') {
      await tx.mesa.update({
        where: { id: reserva.mesaId },
        data: { estado: 'OCUPADA' }
      });
      mesaUpdatedEvent = { mesaId: reserva.mesaId, estado: 'OCUPADA' };
    }

    if ((estado === 'NO_LLEGO' || estado === 'CANCELADA') && reserva.mesa.estado === 'RESERVADA') {
      await tx.mesa.update({
        where: { id: reserva.mesaId },
        data: { estado: 'LIBRE' }
      });
      mesaUpdatedEvent = { mesaId: reserva.mesaId, estado: 'LIBRE' };
    }

    const updated = await tx.reserva.update({
      where: { id },
      data: { estado },
      include: {
        mesa: { select: { numero: true, zona: true } }
      }
    });

    return { reservaActualizada: updated, mesaUpdated: mesaUpdatedEvent };
  });

  const events = [
    ...(mesaUpdated
      ? [{
          topic: 'mesa.updated',
          payload: {
            mesaId: mesaUpdated.mesaId,
            estado: mesaUpdated.estado,
            updatedAt: new Date().toISOString()
          }
        }]
      : []),
    {
      topic: 'reserva.updated',
      payload: {
        id: reservaActualizada.id,
        estado: reservaActualizada.estado,
        mesaId: reservaActualizada.mesaId
      }
    }
  ];

  return { reserva: reservaActualizada, events };
};

const eliminar = async (prisma, id) => {
  await prisma.$transaction(async (tx) => {
    const reserva = await tx.reserva.findUnique({
      where: { id },
      include: { mesa: true }
    });

    if (!reserva) {
      throw createHttpError.notFound('Reserva no encontrada');
    }

    if (reserva.mesa.estado === 'RESERVADA') {
      await tx.mesa.update({
        where: { id: reserva.mesaId },
        data: { estado: 'LIBRE' }
      });
    }

    await tx.reserva.delete({ where: { id } });
  });

  return { message: 'Reserva eliminada' };
};

module.exports = {
  listar,
  reservasProximas,
  obtener,
  crear,
  actualizar,
  cambiarEstado,
  eliminar
};

