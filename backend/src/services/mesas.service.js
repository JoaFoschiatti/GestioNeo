const { createHttpError } = require('../utils/http-error');

const listar = async (prisma, query) => {
  const { estado, activa } = query;

  const where = {};
  if (estado) where.estado = estado;
  if (activa !== undefined) where.activa = activa;

  return prisma.mesa.findMany({
    where,
    orderBy: { numero: 'asc' },
    include: {
      pedidos: {
        where: { estado: { notIn: ['COBRADO', 'CANCELADO'] } },
        take: 1
      }
    }
  });
};

const obtener = async (prisma, id) => {
  const mesa = await prisma.mesa.findUnique({
    where: { id },
    include: {
      pedidos: {
        where: { estado: { notIn: ['COBRADO', 'CANCELADO'] } },
        include: { items: { include: { producto: true } } }
      }
    }
  });

  if (!mesa) {
    throw createHttpError.notFound('Mesa no encontrada');
  }

  return mesa;
};

const crear = async (prisma, data) => {
  const existente = await prisma.mesa.findFirst({ where: { numero: data.numero } });
  if (existente) {
    throw createHttpError.badRequest('Ya existe una mesa con ese número');
  }

  return prisma.mesa.create({
    data
  });
};

const actualizar = async (prisma, id, data) => {
  const existe = await prisma.mesa.findUnique({ where: { id } });
  if (!existe) {
    throw createHttpError.notFound('Mesa no encontrada');
  }

  if (data.numero !== undefined && data.numero !== existe.numero) {
    const numeroExiste = await prisma.mesa.findFirst({ where: { numero: data.numero } });
    if (numeroExiste) {
      throw createHttpError.badRequest('Ya existe una mesa con ese número');
    }
  }

  return prisma.mesa.update({
    where: { id },
    data
  });
};

const cambiarEstado = async (prisma, id, estado) => {
  const mesaExiste = await prisma.mesa.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!mesaExiste) {
    throw createHttpError.notFound('Mesa no encontrada');
  }

  return prisma.mesa.update({
    where: { id },
    data: { estado }
  });
};

const eliminar = async (prisma, id) => {
  const mesaExiste = await prisma.mesa.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!mesaExiste) {
    throw createHttpError.notFound('Mesa no encontrada');
  }

  await prisma.mesa.update({
    where: { id },
    data: { activa: false }
  });

  return { message: 'Mesa desactivada correctamente' };
};

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  cambiarEstado,
  eliminar
};

