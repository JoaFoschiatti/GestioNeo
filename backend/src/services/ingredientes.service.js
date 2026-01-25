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

    await tx.movimientoStock.create({
      data: {
        ingredienteId: id,
        tipo: data.tipo,
        cantidad: data.cantidad,
        motivo: data.motivo || null
      }
    });

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

module.exports = {
  ...baseCrud,
  listar, // Sobrescrito para filtro stockBajo
  obtener, // Sobrescrito para includes detallados
  // Funciones de negocio (sin cambios)
  registrarMovimiento,
  ajustarStock,
  alertasStock,
  verificarProductosDisponibles
};
