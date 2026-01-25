const { createHttpError } = require('../utils/http-error');
const { decimalToNumber } = require('../utils/decimal');
const { createCrudService } = require('./crud-factory.service');

// Crear servicio CRUD base usando el factory
const baseCrud = createCrudService('modificador', {
  uniqueFields: { nombre: 'nombre' },
  defaultOrderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
  softDelete: false, // Hard delete
  entityName: 'modificador',
  gender: 'm',

  // Hook: ajustar precio antes de crear
  beforeCreate: async (prisma, data) => {
    // Validar tipo
    const TIPOS_VALIDOS = ['ADICION', 'EXCLUSION'];
    if (!data.tipo || !TIPOS_VALIDOS.includes(data.tipo)) {
      throw createHttpError.badRequest('Tipo de modificador inválido. Debe ser ADICION o EXCLUSION');
    }

    // Validar y sanitizar nombre
    const nombre = (data.nombre || '').trim();
    if (!nombre || nombre.length < 2 || nombre.length > 100) {
      throw createHttpError.badRequest('El nombre debe tener entre 2 y 100 caracteres');
    }

    // Validar precio
    const precio = parseFloat(data.precio ?? 0);
    if (isNaN(precio) || precio < 0 || precio > 99999) {
      throw createHttpError.badRequest('Precio inválido. Debe estar entre 0 y 99999');
    }

    // Si es EXCLUSION, precio siempre 0
    const precioFinal = data.tipo === 'EXCLUSION' ? 0 : precio;

    return {
      nombre: nombre,
      precio: precioFinal,
      tipo: data.tipo,
      tenantId: data.tenantId // Este viene filtrado por el factory si hay whitelist
    };
  },

  // Hook: ajustar precio antes de actualizar
  beforeUpdate: async (prisma, id, data, existe) => {
    const updateData = {};

    // Validar y sanitizar nombre si se proporciona
    if (data.nombre !== undefined) {
      const nombre = (data.nombre || '').trim();
      if (!nombre || nombre.length < 2 || nombre.length > 100) {
        throw createHttpError.badRequest('El nombre debe tener entre 2 y 100 caracteres');
      }
      updateData.nombre = nombre;
    }

    // Validar tipo si se proporciona
    if (data.tipo !== undefined) {
      const TIPOS_VALIDOS = ['ADICION', 'EXCLUSION'];
      if (!TIPOS_VALIDOS.includes(data.tipo)) {
        throw createHttpError.badRequest('Tipo de modificador inválido. Debe ser ADICION o EXCLUSION');
      }
      updateData.tipo = data.tipo;
    }

    if (data.activo !== undefined) {
      updateData.activo = data.activo;
    }

    // Lógica de precio según tipo
    if (data.precio !== undefined || data.tipo !== undefined) {
      const tipoFinal = data.tipo || existe.tipo;

      // Validar precio si se proporciona
      if (data.precio !== undefined) {
        const precio = parseFloat(data.precio);
        if (isNaN(precio) || precio < 0 || precio > 99999) {
          throw createHttpError.badRequest('Precio inválido. Debe estar entre 0 y 99999');
        }
      }

      updateData.precio = tipoFinal === 'EXCLUSION'
        ? 0
        : (data.precio !== undefined ? data.precio : decimalToNumber(existe.precio));
    }

    return updateData;
  }
});

// Sobrescribir obtener para incluir productos asociados
const obtener = async (prisma, id) => {
  const modificador = await prisma.modificador.findUnique({
    where: { id },
    include: {
      productos: {
        include: {
          producto: { select: { id: true, nombre: true } }
        }
      }
    }
  });

  if (!modificador) {
    throw createHttpError.notFound('Modificador no encontrado');
  }

  return modificador;
};

const modificadoresDeProducto = async (prisma, productoId) => {
  const producto = await prisma.producto.findUnique({
    where: { id: productoId },
    include: {
      modificadores: {
        include: {
          modificador: true
        }
      }
    }
  });

  if (!producto) {
    throw createHttpError.notFound('Producto no encontrado');
  }

  return producto.modificadores.map(pm => pm.modificador);
};

const asignarAProducto = async (prisma, productoId, modificadorIds) => {
  const productoExiste = await prisma.producto.findUnique({
    where: { id: productoId },
    select: { id: true }
  });

  if (!productoExiste) {
    throw createHttpError.notFound('Producto no encontrado');
  }

  const ids = Array.isArray(modificadorIds) ? Array.from(new Set(modificadorIds)) : [];

  if (ids.length > 0) {
    const modificadores = await prisma.modificador.findMany({
      where: { id: { in: ids } },
      select: { id: true }
    });

    const idsValidos = new Set(modificadores.map(m => m.id));
    const idsInvalidos = ids.filter(modId => !idsValidos.has(modId));

    if (idsInvalidos.length > 0) {
      throw createHttpError.badRequest(`Modificadores inválidos: ${idsInvalidos.join(', ')}`);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.productoModificador.deleteMany({
      where: { productoId }
    });

    if (ids.length > 0) {
      await tx.productoModificador.createMany({
        data: ids.map(modId => ({
          productoId,
          modificadorId: modId
        }))
      });
    }
  });

  return prisma.producto.findUnique({
    where: { id: productoId },
    include: {
      modificadores: {
        include: { modificador: true }
      }
    }
  });
};

module.exports = {
  ...baseCrud,
  obtener, // Sobrescribir con versión custom
  modificadoresDeProducto,
  asignarAProducto
};
