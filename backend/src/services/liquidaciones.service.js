const { createHttpError } = require('../utils/http-error');
const { createCrudService } = require('./crud-factory.service');

// Crear servicio CRUD base usando el factory
const baseCrud = createCrudService('liquidacion', {
  defaultOrderBy: { createdAt: 'desc' },
  defaultInclude: {
    empleado: { select: { nombre: true, apellido: true, dni: true } }
  },
  softDelete: false,
  entityName: 'liquidación',
  gender: 'f',

  // Protección mass assignment
  allowedFilterFields: ['empleadoId', 'pagado'],
  allowedCreateFields: ['empleadoId', 'periodoDesde', 'periodoHasta', 'horasTotales', 'descuentos', 'adicionales', 'observaciones'],
  // No allowedUpdateFields - liquidaciones no se actualizan directamente

  // Hook: calcular totales antes de crear
  beforeCreate: async (prisma, data) => {
    if (!data.horasTotales || data.horasTotales <= 0) {
      throw createHttpError.badRequest('Las horas trabajadas son requeridas');
    }

    const empleado = await prisma.empleado.findUnique({
      where: { id: data.empleadoId }
    });

    if (!empleado) {
      throw createHttpError.notFound('Empleado no encontrado');
    }

    const horas = parseFloat(data.horasTotales);
    const tarifaHora = parseFloat(empleado.tarifaHora);
    const descuentos = data.descuentos || 0;
    const adicionales = data.adicionales || 0;
    const subtotal = horas * tarifaHora;
    const totalPagar = subtotal - descuentos + adicionales;

    return {
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
    };
  },

  // Validación: no eliminar liquidaciones pagadas
  customValidations: {
    eliminar: async (prisma, id, item) => {
      if (item.pagado) {
        throw createHttpError.badRequest(
          'No se puede eliminar una liquidación pagada'
        );
      }
    }
  }
});

// Función de negocio: calcular horas desde fichajes
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

// Función de negocio: marcar liquidación como pagada
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

module.exports = {
  ...baseCrud,
  // Funciones de negocio (sin cambios)
  calcular,
  marcarPagada
};

