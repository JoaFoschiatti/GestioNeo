const { createHttpError } = require('../utils/http-error');
const { decimalToNumber } = require('../utils/decimal');

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

const listar = async (prisma, query) => {
  const { activo, stockBajo } = query;

  const where = {};
  if (activo !== undefined) where.activo = activo;

  let ingredientes = await prisma.ingrediente.findMany({
    where,
    orderBy: { nombre: 'asc' }
  });

  if (stockBajo) {
    ingredientes = ingredientes.filter(
      ing => decimalToNumber(ing.stockActual) <= decimalToNumber(ing.stockMinimo)
    );
  }

  return ingredientes;
};

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

const crear = async (prisma, data) => {
  const existente = await prisma.ingrediente.findFirst({ where: { nombre: data.nombre } });
  if (existente) {
    throw createHttpError.badRequest('Ya existe un ingrediente con ese nombre');
  }

  return prisma.$transaction(async (tx) => {
    const ingrediente = await tx.ingrediente.create({
      data
    });

    if (decimalToNumber(ingrediente.stockActual) > 0) {
      await tx.movimientoStock.create({
        data: {
          ingredienteId: ingrediente.id,
          tipo: 'ENTRADA',
          cantidad: ingrediente.stockActual,
          motivo: 'Stock inicial'
        }
      });
    }

    return ingrediente;
  });
};

const actualizar = async (prisma, id, data) => {
  const existe = await prisma.ingrediente.findUnique({ where: { id } });
  if (!existe) {
    throw createHttpError.notFound('Ingrediente no encontrado');
  }

  if (data.nombre && data.nombre !== existe.nombre) {
    const nombreExiste = await prisma.ingrediente.findFirst({ where: { nombre: data.nombre } });
    if (nombreExiste) {
      throw createHttpError.badRequest('Ya existe un ingrediente con ese nombre');
    }
  }

  return prisma.ingrediente.update({
    where: { id },
    data
  });
};

const registrarMovimiento = async (prisma, id, data) => {
  const ingrediente = await prisma.ingrediente.findUnique({ where: { id } });
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

  await prisma.$transaction([
    prisma.ingrediente.update({
      where: { id },
      data: { stockActual: nuevoStock }
    }),
    prisma.movimientoStock.create({
      data: {
        ingredienteId: id,
        tipo: data.tipo,
        cantidad: data.cantidad,
        motivo: data.motivo || null
      }
    })
  ]);

  const ingredienteActualizado = await prisma.ingrediente.findUnique({
    where: { id }
  });

  let events = [];
  if (data.tipo === 'ENTRADA' && nuevoStock > 0) {
    ({ events } = await verificarProductosDisponibles(prisma, id));
  }

  return { ingrediente: ingredienteActualizado, events };
};

const ajustarStock = async (prisma, id, data) => {
  const ingrediente = await prisma.ingrediente.findUnique({ where: { id } });
  if (!ingrediente) {
    throw createHttpError.notFound('Ingrediente no encontrado');
  }

  const stockActual = decimalToNumber(ingrediente.stockActual);
  const stockReal = decimalToNumber(data.stockReal);
  const diferencia = stockReal - stockActual;

  const motivo = data.motivo || `Ajuste de inventario (${diferencia >= 0 ? '+' : ''}${diferencia})`;

  await prisma.$transaction([
    prisma.ingrediente.update({
      where: { id },
      data: { stockActual: stockReal }
    }),
    prisma.movimientoStock.create({
      data: {
        ingredienteId: id,
        tipo: 'AJUSTE',
        cantidad: Math.abs(diferencia),
        motivo
      }
    })
  ]);

  const ingredienteActualizado = await prisma.ingrediente.findUnique({
    where: { id }
  });

  let events = [];
  if (diferencia > 0 && stockReal > 0) {
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
  listar,
  obtener,
  crear,
  actualizar,
  registrarMovimiento,
  ajustarStock,
  alertasStock
};
