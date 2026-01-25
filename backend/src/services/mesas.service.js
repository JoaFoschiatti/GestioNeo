const { createHttpError } = require('../utils/http-error');
const { createCrudService } = require('./crud-factory.service');

// Crear servicio CRUD base usando el factory
const baseCrud = createCrudService('mesa', {
  uniqueFields: { numero: 'número' },
  defaultOrderBy: { numero: 'asc' },
  defaultInclude: {
    pedidos: {
      where: { estado: { notIn: ['COBRADO', 'CANCELADO'] } },
      take: 1
    }
  },
  softDelete: true,
  softDeleteField: 'activa',
  entityName: 'mesa',
  gender: 'f',

  // Protección mass assignment
  allowedFilterFields: ['activa', 'estado', 'capacidad'],
  allowedCreateFields: ['numero', 'capacidad', 'activa'],
  allowedUpdateFields: ['capacidad', 'activa', 'estado']
});

// Sobrescribir obtener para usar include más detallado
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

// Función específica: cambiar estado de la mesa
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

module.exports = {
  ...baseCrud,
  obtener, // Sobrescribir con versión custom
  cambiarEstado
};

