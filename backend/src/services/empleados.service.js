const { createHttpError } = require('../utils/http-error');
const { createCrudService } = require('./crud-factory.service');

// Crear servicio CRUD base usando el factory
const baseCrud = createCrudService('empleado', {
  uniqueFields: { dni: 'DNI' },
  defaultOrderBy: { nombre: 'asc' },
  softDelete: true,
  softDeleteField: 'activo',
  entityName: 'empleado',
  gender: 'm',

  // Protección mass assignment
  allowedFilterFields: ['activo', 'nombre', 'apellido', 'rol'],
  allowedCreateFields: ['nombre', 'apellido', 'dni', 'telefono', 'direccion', 'rol', 'tarifaHora'],
  allowedUpdateFields: ['nombre', 'apellido', 'telefono', 'direccion', 'rol', 'tarifaHora', 'activo']
});

// Sobrescribir obtener para incluir fichajes y liquidaciones
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

module.exports = {
  ...baseCrud,
  obtener // Sobrescribir con versión custom
};

