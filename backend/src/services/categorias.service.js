const { createHttpError } = require('../utils/http-error');

const listar = async (prisma, query) => {
  const { activa } = query;

  const where = {};
  if (activa !== undefined) where.activa = activa;

  return prisma.categoria.findMany({
    where,
    orderBy: { orden: 'asc' },
    include: { _count: { select: { productos: true } } }
  });
};

const listarPublicas = async (prisma) => {
  return prisma.categoria.findMany({
    where: { activa: true },
    orderBy: { orden: 'asc' },
    include: {
      productos: {
        where: { disponible: true },
        orderBy: { nombre: 'asc' }
      }
    }
  });
};

const crear = async (prisma, data) => {
  const existente = await prisma.categoria.findFirst({ where: { nombre: data.nombre } });
  if (existente) {
    throw createHttpError.badRequest('Ya existe una categoría con ese nombre');
  }

  return prisma.categoria.create({
    data
  });
};

const actualizar = async (prisma, id, data) => {
  const existe = await prisma.categoria.findUnique({ where: { id } });
  if (!existe) {
    throw createHttpError.notFound('Categoría no encontrada');
  }

  if (data.nombre && data.nombre !== existe.nombre) {
    const nombreExiste = await prisma.categoria.findFirst({ where: { nombre: data.nombre } });
    if (nombreExiste) {
      throw createHttpError.badRequest('Ya existe una categoría con ese nombre');
    }
  }

  return prisma.categoria.update({
    where: { id },
    data
  });
};

const eliminar = async (prisma, id) => {
  const categoria = await prisma.categoria.findUnique({ where: { id } });
  if (!categoria) {
    throw createHttpError.notFound('Categoría no encontrada');
  }

  const productos = await prisma.producto.count({ where: { categoriaId: id } });
  if (productos > 0) {
    throw createHttpError.badRequest('No se puede eliminar: la categoría tiene productos asociados');
  }

  await prisma.categoria.delete({ where: { id } });

  return { message: 'Categoría eliminada correctamente' };
};

module.exports = {
  listar,
  listarPublicas,
  crear,
  actualizar,
  eliminar
};

