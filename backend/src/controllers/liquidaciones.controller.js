const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Listar liquidaciones
const listar = async (req, res) => {
  try {
    const { empleadoId, pagado } = req.query;

    const where = {};
    if (empleadoId) where.empleadoId = parseInt(empleadoId);
    if (pagado !== undefined) where.pagado = pagado === 'true';

    const liquidaciones = await prisma.liquidacion.findMany({
      where,
      include: { empleado: { select: { nombre: true, apellido: true, dni: true } } },
      orderBy: { createdAt: 'desc' }
    });

    res.json(liquidaciones);
  } catch (error) {
    console.error('Error al listar liquidaciones:', error);
    res.status(500).json({ error: { message: 'Error al obtener liquidaciones' } });
  }
};

// Obtener liquidación por ID
const obtener = async (req, res) => {
  try {
    const { id } = req.params;

    const liquidacion = await prisma.liquidacion.findUnique({
      where: { id: parseInt(id) },
      include: { empleado: true }
    });

    if (!liquidacion) {
      return res.status(404).json({ error: { message: 'Liquidación no encontrada' } });
    }

    res.json(liquidacion);
  } catch (error) {
    console.error('Error al obtener liquidación:', error);
    res.status(500).json({ error: { message: 'Error al obtener liquidación' } });
  }
};

// Calcular liquidación (preview)
const calcular = async (req, res) => {
  try {
    const { empleadoId, fechaDesde, fechaHasta } = req.body;

    const empleado = await prisma.empleado.findUnique({ where: { id: empleadoId } });
    if (!empleado) {
      return res.status(404).json({ error: { message: 'Empleado no encontrado' } });
    }

    // Obtener fichajes del período
    const fichajes = await prisma.fichaje.findMany({
      where: {
        empleadoId,
        fecha: {
          gte: new Date(fechaDesde),
          lte: new Date(fechaHasta)
        },
        salida: { not: null }
      }
    });

    // Calcular horas totales
    let totalMinutos = 0;
    for (const fichaje of fichajes) {
      const entrada = new Date(fichaje.entrada);
      const salida = new Date(fichaje.salida);
      totalMinutos += (salida - entrada) / (1000 * 60);
    }

    const horasTotales = totalMinutos / 60;
    const subtotal = horasTotales * parseFloat(empleado.tarifaHora);

    res.json({
      empleado: {
        id: empleado.id,
        nombre: empleado.nombre,
        apellido: empleado.apellido,
        tarifaHora: empleado.tarifaHora
      },
      periodo: { desde: fechaDesde, hasta: fechaHasta },
      totalFichajes: fichajes.length,
      horasTotales: parseFloat(horasTotales.toFixed(2)),
      tarifaHora: parseFloat(empleado.tarifaHora),
      subtotal: parseFloat(subtotal.toFixed(2))
    });
  } catch (error) {
    console.error('Error al calcular liquidación:', error);
    res.status(500).json({ error: { message: 'Error al calcular liquidación' } });
  }
};

// Crear liquidación
const crear = async (req, res) => {
  try {
    const { empleadoId, periodoDesde, periodoHasta, horasTotales, descuentos, adicionales, observaciones } = req.body;

    // Validar horas
    if (!horasTotales || horasTotales <= 0) {
      return res.status(400).json({ error: { message: 'Las horas trabajadas son requeridas' } });
    }

    const empleado = await prisma.empleado.findUnique({ where: { id: empleadoId } });
    if (!empleado) {
      return res.status(404).json({ error: { message: 'Empleado no encontrado' } });
    }

    // Calcular montos con las horas ingresadas manualmente
    const subtotal = parseFloat(horasTotales) * parseFloat(empleado.tarifaHora);
    const totalPagar = subtotal - (descuentos || 0) + (adicionales || 0);

    const liquidacion = await prisma.liquidacion.create({
      data: {
        empleadoId,
        periodoDesde: new Date(periodoDesde),
        periodoHasta: new Date(periodoHasta),
        horasTotales,
        tarifaHora: empleado.tarifaHora,
        subtotal,
        descuentos: descuentos || 0,
        adicionales: adicionales || 0,
        totalPagar,
        observaciones
      },
      include: { empleado: { select: { nombre: true, apellido: true } } }
    });

    res.status(201).json(liquidacion);
  } catch (error) {
    console.error('Error al crear liquidación:', error);
    res.status(500).json({ error: { message: 'Error al crear liquidación' } });
  }
};

// Marcar como pagada
const marcarPagada = async (req, res) => {
  try {
    const { id } = req.params;

    const liquidacion = await prisma.liquidacion.update({
      where: { id: parseInt(id) },
      data: {
        pagado: true,
        fechaPago: new Date()
      },
      include: { empleado: { select: { nombre: true, apellido: true } } }
    });

    res.json(liquidacion);
  } catch (error) {
    console.error('Error al marcar como pagada:', error);
    res.status(500).json({ error: { message: 'Error al marcar como pagada' } });
  }
};

// Eliminar liquidación (solo si no está pagada)
const eliminar = async (req, res) => {
  try {
    const { id } = req.params;

    const liquidacion = await prisma.liquidacion.findUnique({ where: { id: parseInt(id) } });
    if (!liquidacion) {
      return res.status(404).json({ error: { message: 'Liquidación no encontrada' } });
    }

    if (liquidacion.pagado) {
      return res.status(400).json({ error: { message: 'No se puede eliminar una liquidación pagada' } });
    }

    await prisma.liquidacion.delete({ where: { id: parseInt(id) } });

    res.json({ message: 'Liquidación eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar liquidación:', error);
    res.status(500).json({ error: { message: 'Error al eliminar liquidación' } });
  }
};

module.exports = {
  listar,
  obtener,
  calcular,
  crear,
  marcarPagada,
  eliminar
};
