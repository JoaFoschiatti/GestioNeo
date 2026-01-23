const { createHttpError } = require('../utils/http-error');

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

