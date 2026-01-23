const { createHttpError } = require('../utils/http-error');

const listar = async (prisma, query) => {
  const { empleadoId, fechaDesde, fechaHasta } = query;

  const where = {};
  if (empleadoId) where.empleadoId = empleadoId;
  if (fechaDesde || fechaHasta) {
    where.fecha = {};
    if (fechaDesde) where.fecha.gte = new Date(fechaDesde);
    if (fechaHasta) where.fecha.lte = new Date(fechaHasta);
  }

  return prisma.fichaje.findMany({
    where,
    include: { empleado: { select: { nombre: true, apellido: true } } },
    orderBy: [{ fecha: 'desc' }, { entrada: 'desc' }]
  });
};

const registrarEntrada = async (prisma, empleadoId) => {
  // Verificar empleado existe y está activo
  const empleado = await prisma.empleado.findUnique({ where: { id: empleadoId } });
  if (!empleado || !empleado.activo) {
    throw createHttpError.badRequest('Empleado no válido');
  }

  // Verificar que no tenga un fichaje abierto
  const fichajeAbierto = await prisma.fichaje.findFirst({
    where: {
      empleadoId,
      salida: null
    }
  });

  if (fichajeAbierto) {
    throw createHttpError.badRequest('El empleado ya tiene un fichaje de entrada sin salida');
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  return prisma.fichaje.create({
    data: {
      empleadoId,
      entrada: new Date(),
      fecha: hoy
    },
    include: { empleado: { select: { nombre: true, apellido: true } } }
  });
};

const registrarSalida = async (prisma, empleadoId) => {
  const fichajeAbierto = await prisma.fichaje.findFirst({
    where: {
      empleadoId,
      salida: null
    }
  });

  if (!fichajeAbierto) {
    throw createHttpError.badRequest('No hay fichaje de entrada para registrar salida');
  }

  return prisma.fichaje.update({
    where: { id: fichajeAbierto.id },
    data: { salida: new Date() },
    include: { empleado: { select: { nombre: true, apellido: true } } }
  });
};

const estadoEmpleado = async (prisma, empleadoId) => {
  const fichajeAbierto = await prisma.fichaje.findFirst({
    where: {
      empleadoId,
      salida: null
    }
  });

  return {
    fichado: Boolean(fichajeAbierto),
    fichaje: fichajeAbierto
  };
};

const calcularHoras = async (prisma, empleadoId, fechaDesde, fechaHasta) => {
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

  let totalMinutos = 0;
  for (const fichaje of fichajes) {
    const entrada = new Date(fichaje.entrada);
    const salida = new Date(fichaje.salida);
    totalMinutos += (salida - entrada) / (1000 * 60);
  }

  const horas = Math.floor(totalMinutos / 60);
  const minutos = Math.round(totalMinutos % 60);

  return {
    empleadoId,
    periodo: { desde: fechaDesde, hasta: fechaHasta },
    totalFichajes: fichajes.length,
    horasTotales: totalMinutos / 60,
    formato: `${horas}h ${minutos}m`
  };
};

const editar = async (prisma, id, data) => {
  const fichajeExiste = await prisma.fichaje.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!fichajeExiste) {
    throw createHttpError.notFound('Fichaje no encontrado');
  }

  return prisma.fichaje.update({
    where: { id },
    data: {
      entrada: data.entrada ? new Date(data.entrada) : undefined,
      salida: data.salida ? new Date(data.salida) : undefined
    },
    include: { empleado: { select: { nombre: true, apellido: true } } }
  });
};

module.exports = {
  listar,
  registrarEntrada,
  registrarSalida,
  estadoEmpleado,
  calcularHoras,
  editar
};

