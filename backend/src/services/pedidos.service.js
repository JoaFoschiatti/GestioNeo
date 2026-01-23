const { createHttpError } = require('../utils/http-error');
const printService = require('./print.service');

const buildPedidoItems = async (prisma, items) => {
  if (!items || items.length === 0) {
    throw createHttpError.badRequest('El pedido debe tener al menos un item');
  }

  const productIds = [...new Set(items.map(item => item.productoId))];
  const productos = await prisma.producto.findMany({
    where: { id: { in: productIds } },
    select: { id: true, nombre: true, precio: true, disponible: true }
  });

  const productoById = new Map(productos.map(p => [p.id, p]));

  const modificadorIds = [
    ...new Set(items.flatMap(item => (item.modificadores || [])))
  ];

  const modificadores = modificadorIds.length
    ? await prisma.modificador.findMany({
      where: { id: { in: modificadorIds } },
      select: { id: true, nombre: true, precio: true, activo: true }
    })
    : [];

  const modificadorById = new Map(modificadores.map(m => [m.id, m]));

  let subtotal = 0;
  const itemsConPrecio = [];
  const pedidoItemModificadores = [];

  for (const item of items) {
    const producto = productoById.get(item.productoId);
    if (!producto) {
      throw createHttpError.badRequest(`Producto ${item.productoId} no encontrado`);
    }
    if (!producto.disponible) {
      throw createHttpError.badRequest(`Producto "${producto.nombre}" no está disponible`);
    }

    let precioModificadores = 0;
    const mods = (item.modificadores || []).map(modId => {
      const mod = modificadorById.get(modId);
      if (!mod) {
        throw createHttpError.badRequest(`Modificador ${modId} no encontrado`);
      }
      if (!mod.activo) {
        throw createHttpError.badRequest(`Modificador "${mod.nombre}" no está activo`);
      }
      precioModificadores += parseFloat(mod.precio);
      return mod;
    });

    const precioUnitario = parseFloat(producto.precio) + precioModificadores;
    const itemSubtotal = precioUnitario * item.cantidad;
    subtotal += itemSubtotal;

    itemsConPrecio.push({
      productoId: item.productoId,
      cantidad: item.cantidad,
      precioUnitario,
      subtotal: itemSubtotal,
      observaciones: item.observaciones
    });

    pedidoItemModificadores.push(mods);
  }

  return { subtotal, itemsConPrecio, pedidoItemModificadores };
};

const crearPedido = async (prisma, payload) => {
  const {
    tipo,
    mesaId,
    items,
    clienteNombre,
    clienteTelefono,
    clienteDireccion,
    observaciones,
    usuarioId
  } = payload;

  if (tipo === 'MESA' && !mesaId) {
    throw createHttpError.badRequest('Mesa requerida para pedidos de tipo MESA');
  }

  const { subtotal, itemsConPrecio, pedidoItemModificadores } = await buildPedidoItems(prisma, items);

  const { pedidoId, mesaUpdated } = await prisma.$transaction(async (tx) => {
    let mesaUpdatedLocal = null;

    if (tipo === 'MESA' && mesaId) {
      const mesa = await tx.mesa.findUnique({
        where: { id: mesaId },
        select: { id: true }
      });
      if (!mesa) {
        throw createHttpError.notFound('Mesa no encontrada');
      }

      await tx.mesa.update({
        where: { id: mesaId },
        data: { estado: 'OCUPADA' }
      });

      mesaUpdatedLocal = { mesaId, estado: 'OCUPADA' };
    }

    const pedido = await tx.pedido.create({
      data: {
        tipo,
        mesaId: tipo === 'MESA' ? mesaId : null,
        usuarioId,
        clienteNombre,
        clienteTelefono,
        clienteDireccion,
        subtotal,
        total: subtotal,
        observaciones
      }
    });

    const createdItems = [];
    for (const itemData of itemsConPrecio) {
      const created = await tx.pedidoItem.create({
        data: {
          pedidoId: pedido.id,
          ...itemData
        }
      });
      createdItems.push(created);
    }

    const modificadoresToCreate = [];
    for (let idx = 0; idx < createdItems.length; idx += 1) {
      const pedidoItem = createdItems[idx];
      const mods = pedidoItemModificadores[idx] || [];
      for (const mod of mods) {
        modificadoresToCreate.push({
          pedidoItemId: pedidoItem.id,
          modificadorId: mod.id,
          precio: mod.precio
        });
      }
    }

    if (modificadoresToCreate.length) {
      await tx.pedidoItemModificador.createMany({
        data: modificadoresToCreate
      });
    }

    return { pedidoId: pedido.id, mesaUpdated: mesaUpdatedLocal };
  });

  const pedidoCompleto = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    include: {
      mesa: true,
      usuario: { select: { nombre: true } },
      items: {
        include: {
          producto: true,
          modificadores: { include: { modificador: true } }
        }
      }
    }
  });

  return { pedido: pedidoCompleto, mesaUpdated };
};

const cambiarEstadoPedido = async (prisma, payload) => {
  const { pedidoId, estado } = payload;

  const result = await prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({
      where: { id: pedidoId },
      include: { items: { include: { producto: { include: { ingredientes: true } } } } }
    });

    if (!pedido) {
      throw createHttpError.notFound('Pedido no encontrado');
    }

    const shouldPrint = estado === 'EN_PREPARACION' && pedido.estado === 'PENDIENTE';
    const mesaUpdates = [];
    const productosAgotados = [];

    if (shouldPrint) {
      for (const item of pedido.items) {
        for (const prodIng of item.producto.ingredientes) {
          const cantidadDescontar = parseFloat(prodIng.cantidad) * item.cantidad;

          await tx.ingrediente.update({
            where: { id: prodIng.ingredienteId },
            data: { stockActual: { decrement: cantidadDescontar } }
          });

          await tx.movimientoStock.create({
            data: {
              ingredienteId: prodIng.ingredienteId,
              tipo: 'SALIDA',
              cantidad: cantidadDescontar,
              motivo: `Pedido #${pedido.id}`,
              pedidoId: pedido.id
            }
          });
        }
      }

      const ingredientesAgotados = await tx.ingrediente.findMany({
        where: { stockActual: { lte: 0 } },
        select: { id: true }
      });

      if (ingredientesAgotados.length > 0) {
        const idsIngredientesAgotados = ingredientesAgotados.map(i => i.id);
        const productosAfectados = await tx.producto.findMany({
          where: {
            disponible: true,
            ingredientes: {
              some: { ingredienteId: { in: idsIngredientesAgotados } }
            }
          },
          select: { id: true, nombre: true }
        });

        if (productosAfectados.length > 0) {
          await tx.producto.updateMany({
            where: { id: { in: productosAfectados.map(p => p.id) } },
            data: { disponible: false }
          });
          productosAgotados.push(...productosAfectados);
        }
      }
    }

    if (estado === 'COBRADO' && pedido.mesaId) {
      await tx.mesa.update({
        where: { id: pedido.mesaId },
        data: { estado: 'LIBRE' }
      });
      mesaUpdates.push({ mesaId: pedido.mesaId, estado: 'LIBRE' });
    }

    const pedidoActualizado = await tx.pedido.update({
      where: { id: pedidoId },
      data: { estado },
      include: {
        mesa: true,
        usuario: { select: { nombre: true } },
        items: { include: { producto: true } }
      }
    });

    return {
      pedidoAntes: pedido,
      pedidoActualizado,
      shouldPrint,
      mesaUpdates,
      productosAgotados
    };
  });

  return result;
};

const agregarItemsPedido = async (prisma, payload) => {
  const { pedidoId, items } = payload;

  const result = await prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({ where: { id: pedidoId } });
    if (!pedido) {
      throw createHttpError.notFound('Pedido no encontrado');
    }

    if (['COBRADO', 'CANCELADO'].includes(pedido.estado)) {
      throw createHttpError.badRequest('No se pueden agregar items a este pedido');
    }

    const productIds = [...new Set(items.map(item => item.productoId))];
    const productos = await tx.producto.findMany({
      where: { id: { in: productIds } },
      select: { id: true, precio: true, disponible: true }
    });
    const productoById = new Map(productos.map(p => [p.id, p]));

    let subtotalNuevo = 0;
    const itemsConPrecio = [];

    for (const item of items) {
      const producto = productoById.get(item.productoId);
      if (!producto || !producto.disponible) {
        throw createHttpError.badRequest('Producto no disponible');
      }

      const itemSubtotal = parseFloat(producto.precio) * item.cantidad;
      subtotalNuevo += itemSubtotal;

      itemsConPrecio.push({
        pedidoId,
        productoId: item.productoId,
        cantidad: item.cantidad,
        precioUnitario: producto.precio,
        subtotal: itemSubtotal,
        observaciones: item.observaciones
      });
    }

    await tx.pedidoItem.createMany({ data: itemsConPrecio });

    const pedidoActualizado = await tx.pedido.update({
      where: { id: pedidoId },
      data: {
        subtotal: { increment: subtotalNuevo },
        total: { increment: subtotalNuevo }
      },
      include: {
        mesa: true,
        usuario: { select: { nombre: true } },
        items: { include: { producto: true } }
      }
    });

    return pedidoActualizado;
  });

  return result;
};

const cancelarPedido = async (prisma, payload) => {
  const { pedidoId, motivo } = payload;

  const result = await prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({
      where: { id: pedidoId },
      include: { movimientos: true }
    });

    if (!pedido) {
      throw createHttpError.notFound('Pedido no encontrado');
    }

    if (pedido.estado === 'COBRADO') {
      throw createHttpError.badRequest('No se puede cancelar un pedido cobrado');
    }

    if (pedido.estado !== 'PENDIENTE') {
      for (const mov of pedido.movimientos) {
        if (mov.tipo !== 'SALIDA') continue;

        await tx.ingrediente.update({
          where: { id: mov.ingredienteId },
          data: { stockActual: { increment: parseFloat(mov.cantidad) } }
        });

        await tx.movimientoStock.create({
          data: {
            ingredienteId: mov.ingredienteId,
            tipo: 'ENTRADA',
            cantidad: mov.cantidad,
            motivo: `Cancelación pedido #${pedido.id}`,
            pedidoId: pedido.id
          }
        });
      }
    }

    let mesaUpdated = null;
    if (pedido.mesaId) {
      await tx.mesa.update({
        where: { id: pedido.mesaId },
        data: { estado: 'LIBRE' }
      });
      mesaUpdated = { mesaId: pedido.mesaId, estado: 'LIBRE' };
    }

    const observaciones = pedido.observaciones
      ? `${pedido.observaciones} | CANCELADO: ${motivo || 'Sin motivo'}`
      : `CANCELADO: ${motivo || 'Sin motivo'}`;

    const pedidoCancelado = await tx.pedido.update({
      where: { id: pedidoId },
      data: {
        estado: 'CANCELADO',
        observaciones
      }
    });

    return { pedidoCancelado, mesaUpdated };
  });

  return result;
};

module.exports = {
  listar: async (prisma, query) => {
    const { estado, tipo, fecha, mesaId } = query;

    const where = {};
    if (estado) where.estado = estado;
    if (tipo) where.tipo = tipo;
    if (mesaId) where.mesaId = mesaId;
    if (fecha) {
      const fechaInicio = new Date(fecha);
      const fechaFin = new Date(fecha);
      fechaFin.setDate(fechaFin.getDate() + 1);
      where.createdAt = { gte: fechaInicio, lt: fechaFin };
    }

    const pedidos = await prisma.pedido.findMany({
      where,
      include: {
        mesa: { select: { numero: true, zona: true } },
        usuario: { select: { nombre: true } },
        items: {
          include: {
            producto: { select: { nombre: true } },
            modificadores: { include: { modificador: { select: { nombre: true, tipo: true } } } }
          }
        },
        pagos: true,
        printJobs: { select: { status: true, batchId: true, createdAt: true, lastError: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return pedidos.map(pedido => {
      const impresion = printService.getLatestPrintSummary(pedido.printJobs || []);
      const { printJobs: _printJobs, ...rest } = pedido;
      return { ...rest, impresion };
    });
  },
  obtener: async (prisma, id) => {
    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: {
        mesa: true,
        usuario: { select: { nombre: true, email: true } },
        items: {
          include: {
            producto: true,
            modificadores: { include: { modificador: true } }
          }
        },
        pagos: true,
        printJobs: { select: { status: true, batchId: true, createdAt: true, lastError: true } }
      }
    });

    if (!pedido) {
      throw createHttpError.notFound('Pedido no encontrado');
    }

    const impresion = printService.getLatestPrintSummary(pedido.printJobs || []);
    const { printJobs: _printJobs, ...rest } = pedido;
    return { ...rest, impresion };
  },
  crearPedido,
  cambiarEstadoPedido,
  agregarItemsPedido,
  cancelarPedido
};
