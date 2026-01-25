/**
 * Factory Pattern para Servicios CRUD Genéricos
 *
 * Este factory elimina la duplicación de código en servicios CRUD básicos
 * proporcionando operaciones genéricas configurables para cualquier modelo Prisma.
 *
 * @module crud-factory
 */

const { createHttpError } = require('../utils/http-error');

/**
 * Crea un servicio CRUD genérico para un modelo Prisma
 *
 * @param {string} modelName - Nombre del modelo Prisma (ej: 'mesa', 'categoria')
 * @param {object} options - Configuración del servicio
 * @param {object} [options.uniqueFields={}] - Campos únicos a validar { nombre: 'Nombre', dni: 'DNI' }
 * @param {object} [options.defaultOrderBy={ id: 'asc' }] - Ordenamiento por defecto
 * @param {object} [options.defaultInclude={}] - Relaciones a incluir por defecto
 * @param {boolean} [options.softDelete=false] - Si usa soft delete (activo/activa)
 * @param {string} [options.softDeleteField='activo'] - Campo para soft delete
 * @param {string} [options.entityName] - Nombre para mensajes de error
 * @param {string} [options.entityNamePlural] - Nombre plural para mensajes
 * @param {Array<string>} [options.allowedFilterFields=null] - Campos permitidos en filtros (null = todos)
 * @param {Array<string>} [options.allowedCreateFields=null] - Campos permitidos al crear (null = todos)
 * @param {Array<string>} [options.allowedUpdateFields=null] - Campos permitidos al actualizar (null = todos)
 * @param {Function} [options.beforeCreate] - Hook antes de crear
 * @param {Function} [options.afterCreate] - Hook después de crear
 * @param {Function} [options.beforeUpdate] - Hook antes de actualizar
 * @param {Function} [options.afterUpdate] - Hook después de actualizar
 * @param {Function} [options.beforeDelete] - Hook antes de eliminar
 * @param {Function} [options.afterDelete] - Hook después de eliminar
 * @param {object} [options.customValidations={}] - Validaciones personalizadas
 *
 * @returns {object} Objeto con funciones CRUD: listar, obtener, crear, actualizar, eliminar
 *
 * @example
 * const mesasCrud = createCrudService('mesa', {
 *   uniqueFields: { numero: 'Número' },
 *   softDelete: true,
 *   softDeleteField: 'activa',
 *   entityName: 'Mesa'
 * });
 */
const createCrudService = (modelName, options = {}) => {
  const {
    // Configuración de validación
    uniqueFields = {},

    // Configuración de queries
    defaultOrderBy = { id: 'asc' },
    defaultInclude = {},

    // Configuración de soft delete
    softDelete = false,
    softDeleteField = 'activo',

    // Nombres para mensajes
    entityName = modelName,
    entityNamePlural = `${modelName}s`,
    gender = 'm', // 'm' para masculino, 'f' para femenino (afecta "un/una", "eliminado/eliminada")

    // Mass assignment protection (null = permitir todos los campos)
    allowedFilterFields = null,
    allowedCreateFields = null,
    allowedUpdateFields = null,

    // Hooks para lógica personalizada
    beforeCreate = null,
    beforeUpdate = null,
    beforeDelete = null,
    afterCreate = null,
    afterUpdate = null,
    afterDelete = null,

    // Validaciones personalizadas
    customValidations = {}
  } = options;

  // Artículos y adjetivos según género
  const article = gender === 'f' ? 'una' : 'un';
  const deletedAdj = gender === 'f' ? 'eliminada' : 'eliminado';
  const deactivatedAdj = gender === 'f' ? 'desactivada' : 'desactivado';

  // Capitalizar primera letra para mensajes
  const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

  /**
   * Filtrar campos permitidos de un objeto
   * @param {object} data - Objeto con datos
   * @param {Array<string>|null} allowedFields - Lista de campos permitidos (null = todos)
   * @returns {object} Objeto filtrado con solo campos permitidos
   */
  const filterFields = (data, allowedFields) => {
    if (!allowedFields) return data; // Sin whitelist = permitir todos

    const filtered = {};
    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        filtered[field] = data[field];
      }
    });
    return filtered;
  };

  return {
    /**
     * Listar items con filtros opcionales
     *
     * @param {object} prisma - Cliente Prisma
     * @param {object} [query={}] - Filtros de búsqueda
     * @returns {Promise<Array>} Array de items
     *
     * @example
     * const mesas = await mesasCrud.listar(prisma, { activa: true });
     */
    listar: async (prisma, query = {}) => {
      const where = {};

      // Aplicar filtros de query (solo campos permitidos si hay whitelist)
      Object.keys(query).forEach(key => {
        // Si hay whitelist, validar que el campo esté permitido
        if (allowedFilterFields && !allowedFilterFields.includes(key)) {
          return; // Ignorar campo no permitido
        }

        if (query[key] !== undefined && query[key] !== '') {
          where[key] = query[key];
        }
      });

      return prisma[modelName].findMany({
        where,
        orderBy: defaultOrderBy,
        include: defaultInclude
      });
    },

    /**
     * Obtener item por ID
     *
     * @param {object} prisma - Cliente Prisma
     * @param {number} id - ID del item
     * @returns {Promise<object>} Item encontrado
     * @throws {NotFoundError} Si el item no existe
     *
     * @example
     * const mesa = await mesasCrud.obtener(prisma, 1);
     */
    obtener: async (prisma, id) => {
      const item = await prisma[modelName].findUnique({
        where: { id },
        include: defaultInclude
      });

      if (!item) {
        throw createHttpError.notFound(`${capitalize(entityName)} no ${gender === 'f' ? 'encontrada' : 'encontrado'}`);
      }

      return item;
    },

    /**
     * Crear nuevo item con validación de duplicados
     *
     * @param {object} prisma - Cliente Prisma
     * @param {object} data - Datos del item a crear
     * @returns {Promise<object>} Item creado
     * @throws {BadRequestError} Si existe un duplicado
     *
     * @example
     * const mesa = await mesasCrud.crear(prisma, { numero: 5, capacidad: 4 });
     */
    crear: async (prisma, data) => {
      // Filtrar solo campos permitidos (protección mass assignment)
      if (allowedCreateFields) {
        data = filterFields(data, allowedCreateFields);
      }

      // Hook before create (puede modificar data filtrada)
      if (beforeCreate) {
        data = await beforeCreate(prisma, data);
      }

      try {
        const created = await prisma[modelName].create({
          data,
          include: defaultInclude
        });

        // Hook after create
        if (afterCreate) {
          await afterCreate(prisma, created);
        }

        return created;
      } catch (error) {
        // Capturar violación de constraint único (error P2002 de Prisma)
        if (error.code === 'P2002') {
          // Obtener los campos que violaron la unicidad
          const targets = error.meta?.target || [];
          // Buscar el primer campo que esté en uniqueFields (excluir tenantId)
          const field = targets.find(f => uniqueFields[f]) || targets[0];
          const label = uniqueFields[field] || field || 'campo';
          throw createHttpError.badRequest(
            `Ya existe ${article} ${entityName} con ese ${label}`
          );
        }
        // Re-lanzar otros errores
        throw error;
      }
    },

    /**
     * Actualizar item existente
     *
     * @param {object} prisma - Cliente Prisma
     * @param {number} id - ID del item a actualizar
     * @param {object} data - Datos a actualizar
     * @returns {Promise<object>} Item actualizado
     * @throws {NotFoundError} Si el item no existe
     * @throws {BadRequestError} Si genera un duplicado
     *
     * @example
     * const mesa = await mesasCrud.actualizar(prisma, 1, { capacidad: 6 });
     */
    actualizar: async (prisma, id, data) => {
      // Verificar que existe
      const existe = await prisma[modelName].findUnique({ where: { id } });
      if (!existe) {
        throw createHttpError.notFound(`${capitalize(entityName)} no ${gender === 'f' ? 'encontrada' : 'encontrado'}`);
      }

      // Filtrar solo campos permitidos (protección mass assignment)
      if (allowedUpdateFields) {
        data = filterFields(data, allowedUpdateFields);
      }

      // Hook before update (puede modificar data filtrada)
      if (beforeUpdate) {
        data = await beforeUpdate(prisma, id, data, existe);
      }

      try {
        const updated = await prisma[modelName].update({
          where: { id },
          data,
          include: defaultInclude
        });

        // Hook after update
        if (afterUpdate) {
          await afterUpdate(prisma, updated, existe);
        }

        return updated;
      } catch (error) {
        // Capturar violación de constraint único (error P2002 de Prisma)
        if (error.code === 'P2002') {
          // Obtener los campos que violaron la unicidad
          const targets = error.meta?.target || [];
          // Buscar el primer campo que esté en uniqueFields (excluir tenantId)
          const field = targets.find(f => uniqueFields[f]) || targets[0];
          const label = uniqueFields[field] || field || 'campo';
          throw createHttpError.badRequest(
            `Ya existe ${article} ${entityName} con ese ${label}`
          );
        }
        // Re-lanzar otros errores
        throw error;
      }
    },

    /**
     * Eliminar item (hard delete o soft delete)
     *
     * @param {object} prisma - Cliente Prisma
     * @param {number} id - ID del item a eliminar
     * @returns {Promise<object>} Mensaje de confirmación
     * @throws {NotFoundError} Si el item no existe
     * @throws {BadRequestError} Si la validación personalizada falla
     *
     * @example
     * await mesasCrud.eliminar(prisma, 1);
     */
    eliminar: async (prisma, id) => {
      // Verificar que existe
      const item = await prisma[modelName].findUnique({ where: { id } });
      if (!item) {
        throw createHttpError.notFound(`${capitalize(entityName)} no ${gender === 'f' ? 'encontrada' : 'encontrado'}`);
      }

      // Validaciones personalizadas antes de eliminar
      if (customValidations.eliminar) {
        await customValidations.eliminar(prisma, id, item);
      }

      // Hook before delete
      if (beforeDelete) {
        await beforeDelete(prisma, id, item);
      }

      if (softDelete) {
        // Soft delete: marcar como inactivo
        const deleted = await prisma[modelName].update({
          where: { id },
          data: { [softDeleteField]: false }
        });

        if (afterDelete) {
          await afterDelete(prisma, deleted);
        }

        return { message: `${capitalize(entityName)} ${deactivatedAdj} correctamente` };
      } else {
        // Hard delete: eliminar permanentemente
        await prisma[modelName].delete({ where: { id } });

        if (afterDelete) {
          await afterDelete(prisma, item);
        }

        return { message: `${capitalize(entityName)} ${deletedAdj} correctamente` };
      }
    }
  };
};

module.exports = { createCrudService };
