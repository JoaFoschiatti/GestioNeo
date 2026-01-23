const { createHttpError } = require('../utils/http-error');
const { decimalToNumber } = require('../utils/decimal');

const listar = async (prisma, query) => {
  const { activo, tipo } = query;

  const where = {};
  if (activo !== undefined) where.activo = activo;
  if (tipo) where.tipo = tipo;

  return prisma.modificador.findMany({
    where,
    orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }]
  });
};

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

const crear = async (prisma, data) => {
  const existente = await prisma.modificador.findFirst({ where: { nombre: data.nombre } });
  if (existente) {
    throw createHttpError.badRequest('Ya existe un modificador con ese nombre');
  }

  const precioFinal = data.tipo === 'EXCLUSION' ? 0 : (data.precio ?? 0);

  return prisma.modificador.create({
    data: {
      nombre: data.nombre,
      precio: precioFinal,
      tipo: data.tipo
    }
  });
};

const actualizar = async (prisma, id, data) => {
  const existe = await prisma.modificador.findUnique({ where: { id } });
  if (!existe) {
    throw createHttpError.notFound('Modificador no encontrado');
  }

  if (data.nombre && data.nombre !== existe.nombre) {
    const nombreExiste = await prisma.modificador.findFirst({ where: { nombre: data.nombre } });
    if (nombreExiste) {
      throw createHttpError.badRequest('Ya existe un modificador con ese nombre');
    }
  }

  const updateData = {};
  if (data.nombre !== undefined) updateData.nombre = data.nombre;
  if (data.tipo !== undefined) updateData.tipo = data.tipo;
  if (data.activo !== undefined) updateData.activo = data.activo;

  if (data.precio !== undefined || data.tipo !== undefined) {
    const tipoFinal = data.tipo || existe.tipo;
    updateData.precio = tipoFinal === 'EXCLUSION'
      ? 0
      : (data.precio !== undefined ? data.precio : decimalToNumber(existe.precio));
  }

  return prisma.modificador.update({
    where: { id },
    data: updateData
  });
};

const eliminar = async (prisma, id) => {
  const modificador = await prisma.modificador.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!modificador) {
    throw createHttpError.notFound('Modificador no encontrado');
  }

  await prisma.modificador.delete({
    where: { id }
  });

  return { message: 'Modificador eliminado' };
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
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
  modificadoresDeProducto,
  asignarAProducto
};
