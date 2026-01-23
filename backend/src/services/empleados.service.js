const { createHttpError } = require('../utils/http-error');

const listar = async (prisma, query) => {
  const { activo, rol } = query;

  const where = {};
  if (activo !== undefined) where.activo = activo;
  if (rol) where.rol = rol;

  return prisma.empleado.findMany({
    where,
    orderBy: { nombre: 'asc' }
  });
};

const obtener = async (prisma, id) => {
  const empleado = await prisma.empleado.findUnique({
    where: { id },
    include: {
      fichajes: { orderBy: { fecha: 'desc' }, take: 10 },
      liquidaciones: { orderBy: { createdAt: 'desc' }, take: 5 }
    }
  });

  if (!empleado) {
    throw createHttpError.notFound('Empleado no encontrado');
  }

  return empleado;
};

const crear = async (prisma, data) => {
  const existente = await prisma.empleado.findFirst({ where: { dni: data.dni } });
  if (existente) {
    throw createHttpError.badRequest('Ya existe un empleado con ese DNI');
  }

  return prisma.empleado.create({
    data
  });
};

const actualizar = async (prisma, id, data) => {
  const existe = await prisma.empleado.findUnique({ where: { id } });
  if (!existe) {
    throw createHttpError.notFound('Empleado no encontrado');
  }

  if (data.dni && data.dni !== existe.dni) {
    const dniExiste = await prisma.empleado.findFirst({ where: { dni: data.dni } });
    if (dniExiste) {
      throw createHttpError.badRequest('Ya existe un empleado con ese DNI');
    }
  }

  return prisma.empleado.update({
    where: { id },
    data
  });
};

const eliminar = async (prisma, id) => {
  const empleado = await prisma.empleado.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!empleado) {
    throw createHttpError.notFound('Empleado no encontrado');
  }

  await prisma.empleado.update({
    where: { id },
    data: { activo: false }
  });

  return { message: 'Empleado desactivado correctamente' };
};

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar
};

