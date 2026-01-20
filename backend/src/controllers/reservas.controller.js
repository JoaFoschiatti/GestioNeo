const { PrismaClient } = require('@prisma/client');
const eventBus = require('../services/event-bus');
const prisma = new PrismaClient();

// Listar reservas con filtros
const listar = async (req, res) => {
  try {
    const { fecha, mesaId, estado } = req.query;

    const where = {};

    if (fecha) {
      const fechaInicio = new Date(fecha);
      fechaInicio.setHours(0, 0, 0, 0);
      const fechaFin = new Date(fecha);
      fechaFin.setHours(23, 59, 59, 999);
      where.fechaHora = { gte: fechaInicio, lte: fechaFin };
    }

    if (mesaId) where.mesaId = parseInt(mesaId);
    if (estado) where.estado = estado;

    const reservas = await prisma.reserva.findMany({
      where,
      include: {
        mesa: { select: { numero: true, zona: true, capacidad: true } }
      },
      orderBy: { fechaHora: 'asc' }
    });

    res.json(reservas);
  } catch (error) {
    console.error('Error al listar reservas:', error);
    res.status(500).json({ error: { message: 'Error al obtener reservas' } });
  }
};

// Crear reserva
const crear = async (req, res) => {
  try {
    const { mesaId, clienteNombre, clienteTelefono, fechaHora, cantidadPersonas, observaciones } = req.body;

    const fechaReserva = new Date(fechaHora);

    // Verificar que la mesa existe
    const mesa = await prisma.mesa.findUnique({ where: { id: mesaId } });
    if (!mesa) {
      return res.status(404).json({ error: { message: 'Mesa no encontrada' } });
    }

    // Verificar capacidad
    if (cantidadPersonas > mesa.capacidad) {
      return res.status(400).json({
        error: { message: `La mesa ${mesa.numero} tiene capacidad para ${mesa.capacidad} personas` }
      });
    }

    // Verificar conflictos (reservas dentro de +/- 2 horas)
    const dosHoras = 2 * 60 * 60 * 1000;
    const rangoInicio = new Date(fechaReserva.getTime() - dosHoras);
    const rangoFin = new Date(fechaReserva.getTime() + dosHoras);

    const conflicto = await prisma.reserva.findFirst({
      where: {
        mesaId,
        estado: { in: ['CONFIRMADA', 'CLIENTE_PRESENTE'] },
        fechaHora: { gte: rangoInicio, lte: rangoFin }
      }
    });

    if (conflicto) {
      return res.status(400).json({
        error: { message: `Ya existe una reserva para esta mesa cercana a esa hora` }
      });
    }

    const reserva = await prisma.reserva.create({
      data: {
        mesaId,
        clienteNombre,
        clienteTelefono,
        fechaHora: fechaReserva,
        cantidadPersonas,
        observaciones
      },
      include: {
        mesa: { select: { numero: true, zona: true } }
      }
    });

    eventBus.publish('reserva.created', {
      id: reserva.id,
      mesaId: reserva.mesaId,
      fechaHora: reserva.fechaHora,
      clienteNombre: reserva.clienteNombre
    });

    res.status(201).json(reserva);
  } catch (error) {
    console.error('Error al crear reserva:', error);
    res.status(500).json({ error: { message: 'Error al crear reserva' } });
  }
};

// Actualizar reserva
const actualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const { clienteNombre, clienteTelefono, fechaHora, cantidadPersonas, observaciones } = req.body;

    const reserva = await prisma.reserva.findUnique({ where: { id: parseInt(id) } });
    if (!reserva) {
      return res.status(404).json({ error: { message: 'Reserva no encontrada' } });
    }

    if (reserva.estado !== 'CONFIRMADA') {
      return res.status(400).json({
        error: { message: 'Solo se pueden modificar reservas confirmadas' }
      });
    }

    const datos = {};
    if (clienteNombre) datos.clienteNombre = clienteNombre;
    if (clienteTelefono !== undefined) datos.clienteTelefono = clienteTelefono;
    if (fechaHora) datos.fechaHora = new Date(fechaHora);
    if (cantidadPersonas) datos.cantidadPersonas = cantidadPersonas;
    if (observaciones !== undefined) datos.observaciones = observaciones;

    const reservaActualizada = await prisma.reserva.update({
      where: { id: parseInt(id) },
      data: datos,
      include: {
        mesa: { select: { numero: true, zona: true } }
      }
    });

    res.json(reservaActualizada);
  } catch (error) {
    console.error('Error al actualizar reserva:', error);
    res.status(500).json({ error: { message: 'Error al actualizar reserva' } });
  }
};

// Cambiar estado de reserva
const cambiarEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const reserva = await prisma.reserva.findUnique({
      where: { id: parseInt(id) },
      include: { mesa: true }
    });

    if (!reserva) {
      return res.status(404).json({ error: { message: 'Reserva no encontrada' } });
    }

    // Si el cliente llegó, marcar la mesa como OCUPADA
    if (estado === 'CLIENTE_PRESENTE' && reserva.mesa.estado === 'RESERVADA') {
      await prisma.mesa.update({
        where: { id: reserva.mesaId },
        data: { estado: 'OCUPADA' }
      });

      eventBus.publish('mesa.updated', {
        mesaId: reserva.mesaId,
        estado: 'OCUPADA',
        updatedAt: new Date().toISOString()
      });
    }

    // Si no llegó o se cancela, liberar la mesa si estaba RESERVADA
    if ((estado === 'NO_LLEGO' || estado === 'CANCELADA') && reserva.mesa.estado === 'RESERVADA') {
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

    const reservaActualizada = await prisma.reserva.update({
      where: { id: parseInt(id) },
      data: { estado },
      include: {
        mesa: { select: { numero: true, zona: true } }
      }
    });

    eventBus.publish('reserva.updated', {
      id: reservaActualizada.id,
      estado: reservaActualizada.estado,
      mesaId: reservaActualizada.mesaId
    });

    res.json(reservaActualizada);
  } catch (error) {
    console.error('Error al cambiar estado de reserva:', error);
    res.status(500).json({ error: { message: 'Error al cambiar estado' } });
  }
};

// Obtener reservas próximas (siguientes 30 minutos)
const reservasProximas = async (req, res) => {
  try {
    const ahora = new Date();
    const en30Min = new Date(ahora.getTime() + 30 * 60 * 1000);

    const reservas = await prisma.reserva.findMany({
      where: {
        estado: 'CONFIRMADA',
        fechaHora: { gte: ahora, lte: en30Min }
      },
      include: {
        mesa: { select: { id: true, numero: true, zona: true } }
      },
      orderBy: { fechaHora: 'asc' }
    });

    res.json(reservas);
  } catch (error) {
    console.error('Error al obtener reservas próximas:', error);
    res.status(500).json({ error: { message: 'Error al obtener reservas próximas' } });
  }
};

// Obtener reserva por ID
const obtener = async (req, res) => {
  try {
    const { id } = req.params;

    const reserva = await prisma.reserva.findUnique({
      where: { id: parseInt(id) },
      include: {
        mesa: { select: { numero: true, zona: true, capacidad: true } }
      }
    });

    if (!reserva) {
      return res.status(404).json({ error: { message: 'Reserva no encontrada' } });
    }

    res.json(reserva);
  } catch (error) {
    console.error('Error al obtener reserva:', error);
    res.status(500).json({ error: { message: 'Error al obtener reserva' } });
  }
};

// Eliminar reserva
const eliminar = async (req, res) => {
  try {
    const { id } = req.params;

    const reserva = await prisma.reserva.findUnique({
      where: { id: parseInt(id) },
      include: { mesa: true }
    });

    if (!reserva) {
      return res.status(404).json({ error: { message: 'Reserva no encontrada' } });
    }

    // Si la mesa estaba reservada, liberarla
    if (reserva.mesa.estado === 'RESERVADA') {
      await prisma.mesa.update({
        where: { id: reserva.mesaId },
        data: { estado: 'LIBRE' }
      });
    }

    await prisma.reserva.delete({ where: { id: parseInt(id) } });

    res.json({ message: 'Reserva eliminada' });
  } catch (error) {
    console.error('Error al eliminar reserva:', error);
    res.status(500).json({ error: { message: 'Error al eliminar reserva' } });
  }
};

module.exports = {
  listar,
  crear,
  actualizar,
  cambiarEstado,
  reservasProximas,
  obtener,
  eliminar
};
