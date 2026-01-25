const { createHttpError } = require('../utils/http-error');
const { createCrudService } = require('./crud-factory.service');

// Crear servicio CRUD base usando el factory
const baseCrud = createCrudService('categoria', {
  uniqueFields: { nombre: 'nombre' },
  defaultOrderBy: { orden: 'asc' },
  defaultInclude: {
    _count: { select: { productos: true } }
  },
  softDelete: false, // Hard delete
  entityName: 'categoría',
  gender: 'f',

  // Validación: no eliminar si tiene productos asociados
  customValidations: {
    eliminar: async (prisma, id) => {
      const productos = await prisma.producto.count({
        where: { categoriaId: id }
      });

      if (productos > 0) {
        throw createHttpError.badRequest(
          'No se puede eliminar: la categoría tiene productos asociados'
        );
      }
    }
  }
});

// Función específica: listar categorías públicas con productos disponibles
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

module.exports = {
  ...baseCrud,
  listarPublicas
};

