const { createHttpError } = require('../utils/http-error');

const listar = async (prisma, query) => {
  const { empleadoId, pagado } = query;

  const where = {};
  if (empleadoId) where.empleadoId = empleadoId;
  if (pagado !== undefined) where.pagado = pagado;

  return prisma.liquidacion.findMany({
    where,
    include: { empleado: { select: { nombre: true, apellido: true, dni: true } } },
    orderBy: { createdAt: 'desc' }
  });
};

const obtener = async (prisma, id) => {
  const liquidacion = await prisma.liquidacion.findUnique({
    where: { id },
    include: { empleado: true }
  });

  if (!liquidacion) {
    throw createHttpError.notFound('Liquidación no encontrada');
  }

  return liquidacion;
};

const calcular = async (prisma, empleadoId, fechaDesde, fechaHasta) => {
  const empleado = await prisma.empleado.findUnique({ where: { id: empleadoId } });
  if (!empleado) {
    throw createHttpError.notFound('Empleado no encontrado');
  }

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

  const horasTotales = totalMinutos / 60;
  const tarifaHora = parseFloat(empleado.tarifaHora);
  const subtotal = horasTotales * tarifaHora;

  return {
    empleado: {
      id: empleado.id,
      nombre: empleado.nombre,
      apellido: empleado.apellido,
      tarifaHora: empleado.tarifaHora
    },
    periodo: { desde: fechaDesde, hasta: fechaHasta },
    totalFichajes: fichajes.length,
    horasTotales: parseFloat(horasTotales.toFixed(2)),
    tarifaHora,
    subtotal: parseFloat(subtotal.toFixed(2))
  };
};

const crear = async (prisma, data) => {
  if (!data.horasTotales || data.horasTotales <= 0) {
    throw createHttpError.badRequest('Las horas trabajadas son requeridas');
  }

  const empleado = await prisma.empleado.findUnique({ where: { id: data.empleadoId } });
  if (!empleado) {
    throw createHttpError.notFound('Empleado no encontrado');
  }

  const horas = parseFloat(data.horasTotales);
  const tarifaHora = parseFloat(empleado.tarifaHora);
  const descuentos = data.descuentos || 0;
  const adicionales = data.adicionales || 0;

  const subtotal = horas * tarifaHora;
  const totalPagar = subtotal - descuentos + adicionales;

  return prisma.liquidacion.create({
    data: {
      empleadoId: data.empleadoId,
      periodoDesde: new Date(data.periodoDesde),
      periodoHasta: new Date(data.periodoHasta),
      horasTotales: horas,
      tarifaHora: empleado.tarifaHora,
      subtotal,
      descuentos,
      adicionales,
      totalPagar,
      observaciones: data.observaciones || null
    },
    include: { empleado: { select: { nombre: true, apellido: true } } }
  });
};

const marcarPagada = async (prisma, id) => {
  const liquidacionExiste = await prisma.liquidacion.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!liquidacionExiste) {
    throw createHttpError.notFound('Liquidación no encontrada');
  }

  return prisma.liquidacion.update({
    where: { id },
    data: {
      pagado: true,
      fechaPago: new Date()
    },
    include: { empleado: { select: { nombre: true, apellido: true } } }
  });
};

const eliminar = async (prisma, id) => {
  const liquidacion = await prisma.liquidacion.findUnique({ where: { id } });
  if (!liquidacion) {
    throw createHttpError.notFound('Liquidación no encontrada');
  }

  if (liquidacion.pagado) {
    throw createHttpError.badRequest('No se puede eliminar una liquidación pagada');
  }

  await prisma.liquidacion.delete({ where: { id } });

  return { message: 'Liquidación eliminada correctamente' };
};

module.exports = {
  listar,
  obtener,
  calcular,
  crear,
  marcarPagada,
  eliminar
};

