const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Listar fichajes
const listar = async (req, res) => {
  try {
    const { empleadoId, fechaDesde, fechaHasta } = req.query;

    const where = {};
    if (empleadoId) where.empleadoId = parseInt(empleadoId);
    if (fechaDesde || fechaHasta) {
      where.fecha = {};
      if (fechaDesde) where.fecha.gte = new Date(fechaDesde);
      if (fechaHasta) where.fecha.lte = new Date(fechaHasta);
    }

    const fichajes = await prisma.fichaje.findMany({
      where,
      include: { empleado: { select: { nombre: true, apellido: true } } },
      orderBy: [{ fecha: 'desc' }, { entrada: 'desc' }]
    });

    res.json(fichajes);
  } catch (error) {
    console.error('Error al listar fichajes:', error);
    res.status(500).json({ error: { message: 'Error al obtener fichajes' } });
  }
};

// Registrar entrada
const registrarEntrada = async (req, res) => {
  try {
    const { empleadoId } = req.body;

    // Verificar empleado existe y está activo
    const empleado = await prisma.empleado.findUnique({ where: { id: empleadoId } });
    if (!empleado || !empleado.activo) {
      return res.status(400).json({ error: { message: 'Empleado no válido' } });
    }

    // Verificar que no tenga un fichaje abierto
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const fichajeAbierto = await prisma.fichaje.findFirst({
      where: {
        empleadoId,
        salida: null
      }
    });

    if (fichajeAbierto) {
      return res.status(400).json({
        error: { message: 'El empleado ya tiene un fichaje de entrada sin salida' }
      });
    }

    const fichaje = await prisma.fichaje.create({
      data: {
        empleadoId,
        entrada: new Date(),
        fecha: hoy
      },
      include: { empleado: { select: { nombre: true, apellido: true } } }
    });

    res.status(201).json(fichaje);
  } catch (error) {
    console.error('Error al registrar entrada:', error);
    res.status(500).json({ error: { message: 'Error al registrar entrada' } });
  }
};

// Registrar salida
const registrarSalida = async (req, res) => {
  try {
    const { empleadoId } = req.body;

    // Buscar fichaje abierto
    const fichajeAbierto = await prisma.fichaje.findFirst({
      where: {
        empleadoId,
        salida: null
      }
    });

    if (!fichajeAbierto) {
      return res.status(400).json({
        error: { message: 'No hay fichaje de entrada para registrar salida' }
      });
    }

    const fichaje = await prisma.fichaje.update({
      where: { id: fichajeAbierto.id },
      data: { salida: new Date() },
      include: { empleado: { select: { nombre: true, apellido: true } } }
    });

    res.json(fichaje);
  } catch (error) {
    console.error('Error al registrar salida:', error);
    res.status(500).json({ error: { message: 'Error al registrar salida' } });
  }
};

// Estado actual de fichaje de un empleado
const estadoEmpleado = async (req, res) => {
  try {
    const { empleadoId } = req.params;

    const fichajeAbierto = await prisma.fichaje.findFirst({
      where: {
        empleadoId: parseInt(empleadoId),
        salida: null
      }
    });

    res.json({
      fichado: !!fichajeAbierto,
      fichaje: fichajeAbierto
    });
  } catch (error) {
    console.error('Error al obtener estado:', error);
    res.status(500).json({ error: { message: 'Error al obtener estado' } });
  }
};

// Calcular horas trabajadas de un empleado en un período
const calcularHoras = async (req, res) => {
  try {
    const { empleadoId } = req.params;
    const { fechaDesde, fechaHasta } = req.query;

    if (!fechaDesde || !fechaHasta) {
      return res.status(400).json({ error: { message: 'Fechas requeridas' } });
    }

    const fichajes = await prisma.fichaje.findMany({
      where: {
        empleadoId: parseInt(empleadoId),
        fecha: {
          gte: new Date(fechaDesde),
          lte: new Date(fechaHasta)
        },
        salida: { not: null }
      }
    });

    let totalMinutos = 0;
    for (const fichaje of fichajes) {
      const entrada = new Date(fichaje.entrada);
      const salida = new Date(fichaje.salida);
      totalMinutos += (salida - entrada) / (1000 * 60);
    }

    const horas = Math.floor(totalMinutos / 60);
    const minutos = Math.round(totalMinutos % 60);

    res.json({
      empleadoId: parseInt(empleadoId),
      periodo: { desde: fechaDesde, hasta: fechaHasta },
      totalFichajes: fichajes.length,
      horasTotales: totalMinutos / 60,
      formato: `${horas}h ${minutos}m`
    });
  } catch (error) {
    console.error('Error al calcular horas:', error);
    res.status(500).json({ error: { message: 'Error al calcular horas' } });
  }
};

// Editar fichaje manualmente (solo admin)
const editar = async (req, res) => {
  try {
    const { id } = req.params;
    const { entrada, salida } = req.body;

    const fichaje = await prisma.fichaje.update({
      where: { id: parseInt(id) },
      data: {
        entrada: entrada ? new Date(entrada) : undefined,
        salida: salida ? new Date(salida) : undefined
      },
      include: { empleado: { select: { nombre: true, apellido: true } } }
    });

    res.json(fichaje);
  } catch (error) {
    console.error('Error al editar fichaje:', error);
    res.status(500).json({ error: { message: 'Error al editar fichaje' } });
  }
};

module.exports = {
  listar,
  registrarEntrada,
  registrarSalida,
  estadoEmpleado,
  calcularHoras,
  editar
};
