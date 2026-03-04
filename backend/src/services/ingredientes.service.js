const { createHttpError } = require('../utils/http-error');
const { decimalToNumber } = require('../utils/decimal');
const { createCrudService } = require('./crud-factory.service');

// Helper function: verificar productos disponibles cuando hay stock
const verificarProductosDisponibles = async (prisma, ingredienteId) => {
  const productosNoDisponibles = await prisma.producto.findMany({
    where: {
      disponible: false,
      ingredientes: {
        some: { ingredienteId }
      }
    },
    include: {
      ingredientes: {
        include: { ingrediente: true }
      }
    }
  });

  const productosHabilitados = [];
  const events = [];

  for (const producto of productosNoDisponibles) {
    const todosConStock = producto.ingredientes.every(
      pi => decimalToNumber(pi.ingrediente.stockActual) > 0
    );

    if (!todosConStock) continue;

    await prisma.producto.update({
      where: { id: producto.id },
      data: { disponible: true }
    });

    productosHabilitados.push(producto);
    events.push({
      topic: 'producto.disponible',
      payload: {
        id: producto.id,
        nombre: producto.nombre,
        motivo: 'Stock repuesto',
        updatedAt: new Date().toISOString()
      }
    });
  }

  return { productosHabilitados, events };
};

// Crear servicio CRUD base usando el factory
const baseCrud = createCrudService('ingrediente', {
  uniqueFields: { nombre: 'nombre' },
  defaultOrderBy: { nombre: 'asc' },
  softDelete: true,
  softDeleteField: 'activo',
  entityName: 'ingrediente',
  gender: 'm',

  // Hook: crear movimiento de stock inicial
  afterCreate: async (prisma, ingrediente) => {
    if (decimalToNumber(ingrediente.stockActual) > 0) {
      await prisma.movimientoStock.create({
        data: {
          ingredienteId: ingrediente.id,
          tipo: 'ENTRADA',
          cantidad: ingrediente.stockActual,
          motivo: 'Stock inicial'
        }
      });
    }
  }
});

// Sobrescribir listar para soportar filtro stockBajo
const listar = async (prisma, query) => {
  const { activo, stockBajo } = query;

  let ingredientes = await baseCrud.listar(prisma, { activo });

  if (stockBajo) {
    ingredientes = ingredientes.filter(
      ing => decimalToNumber(ing.stockActual) <= decimalToNumber(ing.stockMinimo)
    );
  }

  return ingredientes;
};

// Sobrescribir obtener con includes detallados
const obtener = async (prisma, id) => {
  const ingrediente = await prisma.ingrediente.findUnique({
    where: { id },
    include: {
      movimientos: {
        orderBy: { createdAt: 'desc' },
        take: 20
      },
      productos: {
        include: { producto: { select: { nombre: true } } }
      }
    }
  });

  if (!ingrediente) {
    throw createHttpError.notFound('Ingrediente no encontrado');
  }

  return ingrediente;
};

const registrarMovimiento = async (prisma, id, data) => {
  // Leer y actualizar dentro de la transacción para evitar race condition
  const result = await prisma.$transaction(async (tx) => {
    const ingrediente = await tx.ingrediente.findUnique({ where: { id } });
    if (!ingrediente) {
      throw createHttpError.notFound('Ingrediente no encontrado');
    }

    const stockActual = decimalToNumber(ingrediente.stockActual);
    const cantidad = decimalToNumber(data.cantidad);

    const nuevoStock = data.tipo === 'ENTRADA'
      ? stockActual + cantidad
      : stockActual - cantidad;

    if (nuevoStock < 0) {
      throw createHttpError.badRequest('Stock insuficiente');
    }

    await tx.ingrediente.update({
      where: { id },
      data: { stockActual: nuevoStock }
    });

    const movimientoData = {
      ingredienteId: id,
      tipo: data.tipo,
      cantidad: data.cantidad,
      motivo: data.motivo || null
    };

    // Para movimientos ENTRADA, guardar categoria de gasto y costo
    if (data.tipo === 'ENTRADA') {
      if (data.categoriaGasto) movimientoData.categoriaGasto = data.categoriaGasto;
      if (data.costoUnitario != null) {
        movimientoData.costoUnitario = data.costoUnitario;
        movimientoData.costoTotal = data.costoUnitario * cantidad;
      }
    }

    await tx.movimientoStock.create({ data: movimientoData });

    return { nuevoStock, tipo: data.tipo };
  });

  const ingredienteActualizado = await prisma.ingrediente.findUnique({
    where: { id }
  });

  let events = [];
  if (result.tipo === 'ENTRADA' && result.nuevoStock > 0) {
    ({ events } = await verificarProductosDisponibles(prisma, id));
  }

  return { ingrediente: ingredienteActualizado, events };
};

const ajustarStock = async (prisma, id, data) => {
  // Leer y actualizar dentro de la transacción para evitar race condition
  const result = await prisma.$transaction(async (tx) => {
    const ingrediente = await tx.ingrediente.findUnique({ where: { id } });
    if (!ingrediente) {
      throw createHttpError.notFound('Ingrediente no encontrado');
    }

    const stockActual = decimalToNumber(ingrediente.stockActual);
    const stockReal = decimalToNumber(data.stockReal);
    const diferencia = stockReal - stockActual;

    const motivo = data.motivo || `Ajuste de inventario (${diferencia >= 0 ? '+' : ''}${diferencia})`;

    await tx.ingrediente.update({
      where: { id },
      data: { stockActual: stockReal }
    });

    await tx.movimientoStock.create({
      data: {
        ingredienteId: id,
        tipo: 'AJUSTE',
        cantidad: Math.abs(diferencia),
        motivo
      }
    });

    return { diferencia, stockReal };
  });

  const ingredienteActualizado = await prisma.ingrediente.findUnique({
    where: { id }
  });

  let events = [];
  if (result.diferencia > 0 && result.stockReal > 0) {
    ({ events } = await verificarProductosDisponibles(prisma, id));
  }

  return { ingrediente: ingredienteActualizado, events };
};

const alertasStock = async (prisma) => {
  const ingredientes = await prisma.ingrediente.findMany({
    where: { activo: true }
  });

  return ingredientes.filter(
    ing => decimalToNumber(ing.stockActual) <= decimalToNumber(ing.stockMinimo)
  );
};

// ============ LOTES ============

const crearLote = async (prisma, ingredienteId, data) => {
  const { cantidad, codigoLote, costoUnitario, fechaVencimiento, categoriaGasto } = data;

  const ingrediente = await prisma.ingrediente.findUnique({ where: { id: ingredienteId } });
  if (!ingrediente) {
    throw createHttpError.notFound('Ingrediente no encontrado');
  }

  const cantidadNum = decimalToNumber(cantidad);

  const result = await prisma.$transaction(async (tx) => {
    // Crear el lote
    const lote = await tx.loteIngrediente.create({
      data: {
        ingredienteId,
        codigoLote: codigoLote || null,
        cantidadInicial: cantidadNum,
        cantidadActual: cantidadNum,
        costoUnitario: costoUnitario != null ? costoUnitario : null,
        fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null
      }
    });

    // Incrementar stock del ingrediente
    await tx.ingrediente.update({
      where: { id: ingredienteId },
      data: { stockActual: { increment: cantidadNum } }
    });

    // Crear movimiento de stock
    const movData = {
      ingredienteId,
      tipo: 'ENTRADA',
      cantidad: cantidadNum,
      motivo: codigoLote ? `Lote: ${codigoLote}` : 'Ingreso por lote',
      loteId: lote.id
    };
    if (categoriaGasto) movData.categoriaGasto = categoriaGasto;
    if (costoUnitario != null) {
      movData.costoUnitario = costoUnitario;
      movData.costoTotal = costoUnitario * cantidadNum;
    }

    await tx.movimientoStock.create({ data: movData });

    return lote;
  });

  // Verificar productos que podrían habilitarse
  const { events } = await verificarProductosDisponibles(prisma, ingredienteId);

  return { lote: result, events };
};

const listarLotes = async (prisma, ingredienteId, query = {}) => {
  const { soloActivos } = query;

  const where = { ingredienteId };
  if (soloActivos) {
    where.agotado = false;
  }

  return prisma.loteIngrediente.findMany({
    where,
    orderBy: { fechaIngreso: 'asc' }
  });
};

const alertasVencimiento = async (prisma, dias = 7) => {
  const limite = new Date();
  limite.setDate(limite.getDate() + dias);

  return prisma.loteIngrediente.findMany({
    where: {
      agotado: false,
      fechaVencimiento: {
        not: null,
        lte: limite
      }
    },
    include: {
      ingrediente: { select: { nombre: true, unidad: true } }
    },
    orderBy: { fechaVencimiento: 'asc' }
  });
};

const descartarLote = async (prisma, loteId) => {
  const lote = await prisma.loteIngrediente.findUnique({
    where: { id: loteId },
    include: { ingrediente: true }
  });

  if (!lote) {
    throw createHttpError.notFound('Lote no encontrado');
  }

  if (lote.agotado) {
    throw createHttpError.badRequest('El lote ya esta agotado');
  }

  const cantidadActual = decimalToNumber(lote.cantidadActual);

  await prisma.$transaction(async (tx) => {
    await tx.loteIngrediente.update({
      where: { id: loteId },
      data: { cantidadActual: 0, agotado: true }
    });

    await tx.ingrediente.update({
      where: { id: lote.ingredienteId },
      data: { stockActual: { decrement: cantidadActual } }
    });

    await tx.movimientoStock.create({
      data: {
        ingredienteId: lote.ingredienteId,
        tipo: 'SALIDA',
        cantidad: cantidadActual,
        motivo: `Descarte lote ${lote.codigoLote || loteId} (vencido)`,
        loteId
      }
    });
  });

  return { descartado: true, cantidad: cantidadActual };
};

module.exports = {
  ...baseCrud,
  listar, // Sobrescrito para filtro stockBajo
  obtener, // Sobrescrito para includes detallados
  // Funciones de negocio (sin cambios)
  registrarMovimiento,
  ajustarStock,
  alertasStock,
  verificarProductosDisponibles,
  // Lotes
  crearLote,
  listarLotes,
  alertasVencimiento,
  descartarLote
};
