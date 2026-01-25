/**
 * Servicio de gestión de productos.
 *
 * Este servicio maneja toda la lógica de negocio relacionada con productos:
 * - CRUD de productos
 * - Gestión de ingredientes por producto
 * - Sistema de variantes (ej: tamaños de pizza)
 * - Agrupación de productos existentes como variantes
 *
 * @module productos.service
 */

const { createHttpError } = require('../utils/http-error');

/**
 * Construye el objeto include para consultas de productos.
 *
 * Incluye: categoría, ingredientes con detalles, variantes ordenadas,
 * y producto base (si es variante).
 *
 * @private
 * @returns {Object} Objeto include para Prisma
 */
const buildProductoInclude = () => ({
  categoria: { select: { id: true, nombre: true } },
  ingredientes: { include: { ingrediente: true } },
  variantes: {
    orderBy: { ordenVariante: 'asc' },
    include: {
      categoria: { select: { id: true, nombre: true } },
      ingredientes: { include: { ingrediente: true } }
    }
  },
  productoBase: { select: { id: true, nombre: true } }
});

/**
 * Lista todos los productos con filtros opcionales.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma
 * @param {Object} query - Filtros de búsqueda
 * @param {number} [query.categoriaId] - Filtrar por categoría
 * @param {boolean} [query.disponible] - Filtrar por disponibilidad
 *
 * @returns {Promise<Array>} Lista de productos con categoría, ingredientes y variantes
 */
const listar = async (prisma, query) => {
  const { categoriaId, disponible } = query;

  const where = {};
  if (categoriaId) where.categoriaId = categoriaId;
  if (disponible !== undefined) where.disponible = disponible;

  return prisma.producto.findMany({
    where,
    include: buildProductoInclude(),
    orderBy: { nombre: 'asc' }
  });
};

/**
 * Lista productos base (excluyendo variantes).
 *
 * Útil para mostrar el catálogo agrupado donde las variantes
 * aparecen anidadas dentro de su producto base.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma
 * @param {Object} query - Filtros de búsqueda
 * @param {number} [query.categoriaId] - Filtrar por categoría
 * @param {boolean} [query.disponible] - Filtrar por disponibilidad
 *
 * @returns {Promise<Array>} Lista de productos base con sus variantes anidadas
 */
const listarConVariantes = async (prisma, query) => {
  const { categoriaId, disponible } = query;

  const where = { productoBaseId: null };
  if (categoriaId) where.categoriaId = categoriaId;
  if (disponible !== undefined) where.disponible = disponible;

  return prisma.producto.findMany({
    where,
    include: buildProductoInclude(),
    orderBy: { nombre: 'asc' }
  });
};

/**
 * Obtiene un producto por ID.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma
 * @param {number} id - ID del producto
 *
 * @returns {Promise<Object>} Producto con categoría e ingredientes
 *
 * @throws {HttpError} 404 - Producto no encontrado
 */
const obtener = async (prisma, id) => {
  const producto = await prisma.producto.findUnique({
    where: { id },
    include: {
      categoria: true,
      ingredientes: { include: { ingrediente: true } }
    }
  });

  if (!producto) {
    throw createHttpError.notFound('Producto no encontrado');
  }

  return producto;
};

/**
 * Crea un nuevo producto con ingredientes opcionales.
 *
 * El producto se crea dentro de una transacción para garantizar
 * que si falla la creación de ingredientes, el producto no se guarde.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma
 * @param {Object} data - Datos del producto
 * @param {string} data.nombre - Nombre del producto
 * @param {string} [data.descripcion] - Descripción
 * @param {number} data.precio - Precio en moneda local
 * @param {number} data.categoriaId - ID de la categoría
 * @param {boolean} [data.disponible=true] - Si está disponible
 * @param {boolean} [data.destacado=false] - Si aparece en destacados
 * @param {Array<Object>} [data.ingredientes] - Ingredientes del producto
 * @param {number} data.ingredientes[].ingredienteId - ID del ingrediente
 * @param {number} data.ingredientes[].cantidad - Cantidad por unidad
 * @param {Express.Multer.File} [file] - Imagen del producto
 *
 * @returns {Promise<Object>} Producto creado con relaciones
 */
const crear = async (prisma, data, file) => {
  const imagen = file ? `/uploads/${file.filename}` : null;
  const { ingredientes, ...productoData } = data;

  const productoId = await prisma.$transaction(async (tx) => {
    const producto = await tx.producto.create({
      data: {
        ...productoData,
        imagen
      }
    });

    if (ingredientes && ingredientes.length > 0) {
      await tx.productoIngrediente.createMany({
        data: ingredientes.map(ing => ({
          productoId: producto.id,
          ingredienteId: ing.ingredienteId,
          cantidad: ing.cantidad
        }))
      });
    }

    return producto.id;
  });

  return prisma.producto.findUnique({
    where: { id: productoId },
    include: { categoria: true, ingredientes: { include: { ingrediente: true } } }
  });
};

/**
 * Actualiza un producto existente.
 *
 * Si se proporcionan ingredientes, reemplaza todos los existentes.
 * Si se proporciona una imagen, actualiza la ruta de la imagen.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma
 * @param {number} id - ID del producto
 * @param {Object} data - Datos a actualizar
 * @param {Express.Multer.File} [file] - Nueva imagen
 *
 * @returns {Promise<Object>} Producto actualizado
 *
 * @throws {HttpError} 404 - Producto no encontrado
 */
const actualizar = async (prisma, id, data, file) => {
  const imagen = file ? `/uploads/${file.filename}` : undefined;
  const { ingredientes, ...productoData } = data;

  const productoId = await prisma.$transaction(async (tx) => {
    const existe = await tx.producto.findUnique({ where: { id }, select: { id: true } });
    if (!existe) {
      throw createHttpError.notFound('Producto no encontrado');
    }

    if (ingredientes) {
      await tx.productoIngrediente.deleteMany({
        where: { productoId: id }
      });
    }

    await tx.producto.update({
      where: { id },
      data: {
        ...productoData,
        ...(imagen ? { imagen } : {})
      }
    });

    if (ingredientes && ingredientes.length > 0) {
      await tx.productoIngrediente.createMany({
        data: ingredientes.map(ing => ({
          productoId: id,
          ingredienteId: ing.ingredienteId,
          cantidad: ing.cantidad
        }))
      });
    }

    return id;
  });

  return prisma.producto.findUnique({
    where: { id: productoId },
    include: { categoria: true, ingredientes: { include: { ingrediente: true } } }
  });
};

/**
 * Cambia la disponibilidad de un producto.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma
 * @param {number} id - ID del producto
 * @param {boolean} disponible - Nueva disponibilidad
 *
 * @returns {Promise<Object>} Producto actualizado
 *
 * @throws {HttpError} 404 - Producto no encontrado
 */
const cambiarDisponibilidad = async (prisma, id, disponible) => {
  const productoExiste = await prisma.producto.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!productoExiste) {
    throw createHttpError.notFound('Producto no encontrado');
  }

  return prisma.producto.update({
    where: { id },
    data: { disponible }
  });
};

/**
 * Elimina (desactiva) un producto.
 *
 * En lugar de eliminar físicamente, marca el producto como no disponible
 * para mantener integridad referencial con pedidos históricos.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma
 * @param {number} id - ID del producto
 *
 * @returns {Promise<Object>} Mensaje de confirmación
 *
 * @throws {HttpError} 404 - Producto no encontrado
 */
const eliminar = async (prisma, id) => {
  const productoExiste = await prisma.producto.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!productoExiste) {
    throw createHttpError.notFound('Producto no encontrado');
  }

  await prisma.producto.update({
    where: { id },
    data: { disponible: false }
  });

  return { message: 'Producto desactivado correctamente' };
};

/**
 * Crea una variante de un producto existente.
 *
 * Las variantes heredan la imagen, categoría y disponibilidad del producto base.
 * También copian los ingredientes, pudiendo ajustar las cantidades con el
 * multiplicador de insumos.
 *
 * Ejemplo: Pizza Grande como variante de Pizza, con multiplicador 1.5
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma
 * @param {number} productoBaseId - ID del producto base
 * @param {Object} data - Datos de la variante
 * @param {string} data.nombreVariante - Nombre de la variante (ej: "Grande")
 * @param {number} data.precio - Precio de la variante
 * @param {number} [data.multiplicadorInsumos=1.0] - Multiplicador para ingredientes
 * @param {number} [data.ordenVariante=0] - Orden de visualización
 * @param {boolean} [data.esVariantePredeterminada=false] - Si es la opción por defecto
 * @param {string} [data.descripcion] - Descripción específica de la variante
 *
 * @returns {Promise<Object>} Variante creada
 *
 * @throws {HttpError} 404 - Producto base no encontrado
 * @throws {HttpError} 400 - No se puede crear variante de otra variante
 */
const crearVariante = async (prisma, productoBaseId, data) => {
  const productoBase = await prisma.producto.findUnique({
    where: { id: productoBaseId },
    include: { ingredientes: true }
  });

  if (!productoBase) {
    throw createHttpError.notFound('Producto base no encontrado');
  }

  if (productoBase.productoBaseId !== null) {
    throw createHttpError.badRequest('No se puede crear variante de otra variante');
  }

  const {
    nombreVariante,
    precio,
    multiplicadorInsumos,
    ordenVariante,
    esVariantePredeterminada,
    descripcion
  } = data;

  const result = await prisma.$transaction(async (tx) => {
    if (esVariantePredeterminada) {
      await tx.producto.updateMany({
        where: { productoBaseId },
        data: { esVariantePredeterminada: false }
      });
    }

    const variante = await tx.producto.create({
      data: {
        nombre: `${productoBase.nombre} ${nombreVariante}`,
        descripcion: descripcion || productoBase.descripcion,
        precio,
        imagen: productoBase.imagen,
        categoriaId: productoBase.categoriaId,
        disponible: productoBase.disponible,
        destacado: false,
        productoBaseId,
        nombreVariante,
        multiplicadorInsumos: multiplicadorInsumos || 1.0,
        ordenVariante: ordenVariante || 0,
        esVariantePredeterminada: esVariantePredeterminada || false
      }
    });

    if (productoBase.ingredientes.length > 0) {
      await tx.productoIngrediente.createMany({
        data: productoBase.ingredientes.map(ing => ({
          productoId: variante.id,
          ingredienteId: ing.ingredienteId,
          cantidad: ing.cantidad
        }))
      });
    }

    return variante.id;
  });

  return prisma.producto.findUnique({
    where: { id: result },
    include: {
      categoria: { select: { id: true, nombre: true } },
      ingredientes: { include: { ingrediente: true } }
    }
  });
};

/**
 * Agrupa productos existentes como variantes de un producto base.
 *
 * Convierte productos independientes en variantes de otro producto.
 * Útil para reorganizar el catálogo sin perder historial de pedidos.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma
 * @param {Object} payload - Datos de agrupación
 * @param {number} payload.productoBaseId - ID del producto que será el base
 * @param {Array<Object>} payload.variantes - Productos a convertir en variantes
 * @param {number} payload.variantes[].productoId - ID del producto
 * @param {string} payload.variantes[].nombreVariante - Nombre como variante
 * @param {number} [payload.variantes[].multiplicadorInsumos] - Multiplicador
 * @param {number} [payload.variantes[].ordenVariante] - Orden
 * @param {boolean} [payload.variantes[].esVariantePredeterminada] - Si es default
 *
 * @returns {Promise<Object>} Producto base con variantes anidadas
 *
 * @throws {HttpError} 404 - Producto base no encontrado
 * @throws {HttpError} 400 - Producto base no puede ser variante
 * @throws {HttpError} 400 - Producto base no puede incluirse como variante
 * @throws {HttpError} 400 - Productos ya son variantes
 * @throws {HttpError} 400 - Solo una variante puede ser predeterminada
 */
const agruparComoVariantes = async (prisma, payload) => {
  const { productoBaseId, variantes } = payload;

  const productoBase = await prisma.producto.findUnique({
    where: { id: productoBaseId },
    select: { id: true, productoBaseId: true }
  });

  if (!productoBase) {
    throw createHttpError.notFound('Producto base no encontrado');
  }

  if (productoBase.productoBaseId !== null) {
    throw createHttpError.badRequest('El producto base no puede ser una variante');
  }

  const idsVariantes = variantes.map(v => v.productoId);
  if (idsVariantes.includes(productoBaseId)) {
    throw createHttpError.badRequest('El producto base no puede incluirse como variante');
  }

  const productosVariantes = await prisma.producto.findMany({
    where: { id: { in: idsVariantes } },
    select: { id: true, productoBaseId: true }
  });

  const idsValidos = new Set(productosVariantes.map(p => p.id));
  const idsInvalidos = idsVariantes.filter(vid => !idsValidos.has(vid));
  if (idsInvalidos.length > 0) {
    throw createHttpError.badRequest(`Productos no válidos para agrupar: ${idsInvalidos.join(', ')}`);
  }

  const idsYaAgrupados = productosVariantes.filter(p => p.productoBaseId !== null).map(p => p.id);
  if (idsYaAgrupados.length > 0) {
    throw createHttpError.badRequest(`Productos ya son variantes: ${idsYaAgrupados.join(', ')}`);
  }

  const defaultVariants = variantes.filter(v => v.esVariantePredeterminada);
  if (defaultVariants.length > 1) {
    throw createHttpError.badRequest('Solo una variante puede ser predeterminada');
  }

  const defaultVarianteId = defaultVariants[0]?.productoId || null;

  await prisma.$transaction(async (tx) => {
    if (defaultVarianteId) {
      await tx.producto.updateMany({
        where: { productoBaseId },
        data: { esVariantePredeterminada: false }
      });
    }

    for (const v of variantes) {
      await tx.producto.update({
        where: { id: v.productoId },
        data: {
          productoBaseId,
          nombreVariante: v.nombreVariante,
          multiplicadorInsumos: v.multiplicadorInsumos || 1.0,
          ordenVariante: v.ordenVariante || 0,
          esVariantePredeterminada: defaultVarianteId ? v.productoId === defaultVarianteId : (v.esVariantePredeterminada || false)
        }
      });
    }
  });

  return prisma.producto.findUnique({
    where: { id: productoBaseId },
    include: {
      categoria: { select: { id: true, nombre: true } },
      variantes: {
        orderBy: { ordenVariante: 'asc' },
        include: {
          categoria: { select: { id: true, nombre: true } }
        }
      }
    }
  });
};

/**
 * Desagrupa una variante convirtiéndola en producto independiente.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma
 * @param {number} id - ID del producto variante
 *
 * @returns {Promise<Object>} Producto como independiente
 *
 * @throws {HttpError} 404 - Producto no encontrado
 * @throws {HttpError} 400 - El producto no es una variante
 */
const desagruparVariante = async (prisma, id) => {
  const producto = await prisma.producto.findUnique({
    where: { id }
  });

  if (!producto) {
    throw createHttpError.notFound('Producto no encontrado');
  }

  if (producto.productoBaseId === null) {
    throw createHttpError.badRequest('El producto no es una variante');
  }

  return prisma.producto.update({
    where: { id },
    data: {
      productoBaseId: null,
      nombreVariante: null,
      multiplicadorInsumos: 1.0,
      ordenVariante: 0,
      esVariantePredeterminada: false
    },
    include: {
      categoria: { select: { id: true, nombre: true } }
    }
  });
};

/**
 * Actualiza los datos de una variante.
 *
 * Si se marca como predeterminada, desmarca las demás variantes
 * del mismo producto base.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma
 * @param {number} id - ID de la variante
 * @param {Object} data - Datos a actualizar
 * @param {boolean} [data.esVariantePredeterminada] - Si es la opción default
 *
 * @returns {Promise<Object>} Variante actualizada
 *
 * @throws {HttpError} 404 - Variante no encontrada
 * @throws {HttpError} 400 - El producto no es una variante
 */
const actualizarVariante = async (prisma, id, data) => {
  const producto = await prisma.producto.findUnique({
    where: { id }
  });

  if (!producto) {
    throw createHttpError.notFound('Variante no encontrada');
  }

  if (producto.productoBaseId === null) {
    throw createHttpError.badRequest('El producto no es una variante');
  }

  const { esVariantePredeterminada } = data;

  if (esVariantePredeterminada) {
    await prisma.producto.updateMany({
      where: {
        productoBaseId: producto.productoBaseId,
        id: { not: id }
      },
      data: { esVariantePredeterminada: false }
    });
  }

  return prisma.producto.update({
    where: { id },
    data,
    include: {
      categoria: { select: { id: true, nombre: true } },
      ingredientes: { include: { ingrediente: true } }
    }
  });
};

module.exports = {
  listar,
  listarConVariantes,
  obtener,
  crear,
  actualizar,
  cambiarDisponibilidad,
  eliminar,
  crearVariante,
  agruparComoVariantes,
  desagruparVariante,
  actualizarVariante
};

