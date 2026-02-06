/**
 * Servicio de gestión de pedidos.
 *
 * Este servicio maneja toda la lógica de negocio relacionada con pedidos:
 * - Creación de pedidos con items y modificadores
 * - Cambio de estados (PENDIENTE → EN_PREPARACION → LISTO → ENTREGADO → COBRADO)
 * - Descuento automático de stock de ingredientes
 * - Liberación de mesas al cobrar
 * - Cancelación con reversión de stock
 *
 * @module pedidos.service
 */

const { createHttpError } = require('../utils/http-error');
const { toNumber, sumMoney, multiplyMoney } = require('../utils/decimal');
const printService = require('./print.service');

/**
 * Construye los items de un pedido con precios calculados.
 *
 * Esta función auxiliar:
 * 1. Valida que todos los productos existan y estén disponibles
 * 2. Valida que todos los modificadores existan y estén activos
 * 3. Calcula el precio unitario (producto + modificadores)
 * 4. Calcula el subtotal de cada item
 *
 * @private
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma
 * @param {Array<Object>} items - Items del pedido
 * @param {number} items[].productoId - ID del producto
 * @param {number} items[].cantidad - Cantidad
 * @param {Array<number>} [items[].modificadores] - IDs de modificadores
 * @param {string} [items[].observaciones] - Observaciones del item
 *
 * @returns {Promise<Object>} Resultado con items procesados
 * @returns {number} returns.subtotal - Subtotal calculado
 * @returns {Array} returns.itemsConPrecio - Items con precios calculados
 * @returns {Array} returns.pedidoItemModificadores - Modificadores por item
 *
 * @throws {HttpError} 400 - Si no hay items
 * @throws {HttpError} 400 - Si un producto no existe o no está disponible
 * @throws {HttpError} 400 - Si un modificador no existe o no está activo
 */
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
      precioModificadores = sumMoney(precioModificadores, mod.precio);
      return mod;
    });

    const precioUnitario = sumMoney(producto.precio, precioModificadores);
    const itemSubtotal = multiplyMoney(precioUnitario, item.cantidad);
    subtotal = sumMoney(subtotal, itemSubtotal);

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

/**
 * Crea un nuevo pedido con sus items y modificadores.
 *
 * Este servicio maneja la creación completa de un pedido incluyendo:
 * - Validación de productos y disponibilidad
 * - Cálculo de precios con modificadores
 * - Actualización del estado de la mesa a OCUPADA (si aplica)
 * - Creación de items con sus modificadores en una transacción
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma con scoping de tenant
 * @param {Object} payload - Datos del pedido
 * @param {('MESA'|'DELIVERY'|'MOSTRADOR')} payload.tipo - Tipo de pedido
 * @param {number} [payload.mesaId] - ID de mesa (requerido si tipo='MESA')
 * @param {number} [payload.usuarioId] - ID del usuario que crea el pedido
 * @param {Array<Object>} payload.items - Items del pedido
 * @param {number} payload.items[].productoId - ID del producto
 * @param {number} payload.items[].cantidad - Cantidad (mínimo 1)
 * @param {Array<number>} [payload.items[].modificadores] - IDs de modificadores
 * @param {string} [payload.items[].observaciones] - Observaciones del item
 * @param {string} [payload.clienteNombre] - Nombre del cliente (delivery)
 * @param {string} [payload.clienteTelefono] - Teléfono del cliente
 * @param {string} [payload.clienteDireccion] - Dirección de entrega
 * @param {string} [payload.observaciones] - Observaciones generales
 *
 * @returns {Promise<Object>} Resultado de la creación
 * @returns {Object} returns.pedido - Pedido creado con relaciones incluidas
 * @returns {Object|null} returns.mesaUpdated - Info de mesa actualizada o null
 *
 * @throws {HttpError} 400 - Mesa requerida para pedidos de tipo MESA
 * @throws {HttpError} 404 - Mesa no encontrada
 * @throws {HttpError} 400 - Producto no disponible
 *
 * @example
 * const result = await crearPedido(prisma, {
 *   tipo: 'MESA',
 *   mesaId: 1,
 *   usuarioId: 5,
 *   items: [
 *     { productoId: 10, cantidad: 2, modificadores: [1, 3] },
 *     { productoId: 15, cantidad: 1, observaciones: 'Sin cebolla' }
 *   ]
 * });
 */
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

    // Create all items in parallel to avoid N+1 query problem
    const createdItems = await Promise.all(
      itemsConPrecio.map(itemData =>
        tx.pedidoItem.create({
          data: {
            pedidoId: pedido.id,
            ...itemData
          }
        })
      )
    );

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

/**
 * Cambia el estado de un pedido y ejecuta acciones asociadas.
 *
 * Flujo de estados válidos:
 * ```
 * PENDIENTE → EN_PREPARACION → LISTO → ENTREGADO → COBRADO
 *     ↓              ↓           ↓         ↓
 * CANCELADO    CANCELADO    CANCELADO  CANCELADO
 * ```
 *
 * Acciones automáticas por estado:
 * - **EN_PREPARACION**: Descuenta stock de ingredientes, crea movimientos,
 *   marca productos como agotados si el stock llega a 0
 * - **COBRADO**: Libera la mesa (cambia a LIBRE)
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma
 * @param {Object} payload - Datos para el cambio de estado
 * @param {number} payload.pedidoId - ID del pedido
 * @param {('PENDIENTE'|'EN_PREPARACION'|'LISTO'|'ENTREGADO'|'COBRADO'|'CANCELADO')} payload.estado - Nuevo estado
 *
 * @returns {Promise<Object>} Resultado del cambio de estado
 * @returns {Object} returns.pedidoAntes - Estado previo del pedido (para comparación)
 * @returns {Object} returns.pedidoActualizado - Pedido con el nuevo estado
 * @returns {boolean} returns.shouldPrint - Si debe imprimirse comanda (true cuando pasa a EN_PREPARACION)
 * @returns {Array<Object>} returns.mesaUpdates - Mesas que cambiaron estado [{mesaId, estado}]
 * @returns {Array<Object>} returns.productosAgotados - Productos marcados como no disponibles
 *
 * @throws {HttpError} 404 - Pedido no encontrado
 *
 * @example
 * // Enviar pedido a cocina
 * const result = await cambiarEstadoPedido(prisma, {
 *   pedidoId: 123,
 *   estado: 'EN_PREPARACION'
 * });
 *
 * if (result.shouldPrint) {
 *   await imprimirComanda(result.pedidoActualizado);
 * }
 *
 * if (result.productosAgotados.length > 0) {
 *   notificarProductosAgotados(result.productosAgotados);
 * }
 */
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
      // Optimize N+1 query: Collect all stock movements first
      const stockMovements = [];
      const ingredienteUpdates = new Map(); // ingredienteId -> total cantidad a descontar

      for (const item of pedido.items) {
        for (const prodIng of item.producto.ingredientes) {
          const cantidadDescontar = multiplyMoney(prodIng.cantidad, item.cantidad);
          const ingredienteId = prodIng.ingredienteId;

          // Accumulate total cantidad for this ingrediente
          const currentTotal = ingredienteUpdates.get(ingredienteId) || 0;
          ingredienteUpdates.set(ingredienteId, currentTotal + cantidadDescontar);

          stockMovements.push({
            ingredienteId,
            tipo: 'SALIDA',
            cantidad: cantidadDescontar,
            motivo: `Pedido #${pedido.id}`,
            pedidoId: pedido.id
          });
        }
      }

      // Validar stock disponible ANTES de descontar
      for (const [ingredienteId, cantidadTotal] of ingredienteUpdates.entries()) {
        const ingrediente = await tx.ingrediente.findUnique({
          where: { id: ingredienteId },
          select: { id: true, nombre: true, stockActual: true }
        });

        const stockActual = toNumber(ingrediente?.stockActual || 0);

        if (stockActual < cantidadTotal) {
          throw createHttpError.badRequest(
            `Stock insuficiente de ${ingrediente.nombre} para completar el pedido. Disponible: ${stockActual}, Necesario: ${cantidadTotal}`
          );
        }
      }

      // Execute all updates and creates in parallel
      await Promise.all([
        // Update all ingredientes in parallel
        ...Array.from(ingredienteUpdates.entries()).map(([ingredienteId, cantidadTotal]) =>
          tx.ingrediente.update({
            where: { id: ingredienteId },
            data: { stockActual: { decrement: cantidadTotal } }
          })
        ),
        // Create all stock movements in batch
        stockMovements.length > 0 ? tx.movimientoStock.createMany({ data: stockMovements }) : Promise.resolve()
      ]);

      // Check for depleted stock
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

/**
 * Agrega items adicionales a un pedido existente.
 *
 * Permite agregar más productos a un pedido que aún no ha sido cobrado o cancelado.
 * Actualiza automáticamente el subtotal y total del pedido.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma
 * @param {Object} payload - Datos de los items a agregar
 * @param {number} payload.pedidoId - ID del pedido
 * @param {Array<Object>} payload.items - Nuevos items
 * @param {number} payload.items[].productoId - ID del producto
 * @param {number} payload.items[].cantidad - Cantidad
 * @param {string} [payload.items[].observaciones] - Observaciones
 *
 * @returns {Promise<Object>} Pedido actualizado con todos los items
 *
 * @throws {HttpError} 404 - Pedido no encontrado
 * @throws {HttpError} 400 - No se pueden agregar items a pedido COBRADO o CANCELADO
 * @throws {HttpError} 400 - Producto no disponible
 */
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

      const itemSubtotal = multiplyMoney(producto.precio, item.cantidad);
      subtotalNuevo = sumMoney(subtotalNuevo, itemSubtotal);

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

/**
 * Cancela un pedido y revierte el stock si es necesario.
 *
 * Si el pedido ya había pasado a EN_PREPARACION (stock descontado),
 * esta función revierte los movimientos de stock creando entradas.
 * También libera la mesa si el pedido era de tipo MESA.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma
 * @param {Object} payload - Datos de cancelación
 * @param {number} payload.pedidoId - ID del pedido a cancelar
 * @param {string} [payload.motivo] - Motivo de la cancelación
 *
 * @returns {Promise<Object>} Resultado de la cancelación
 * @returns {Object} returns.pedidoCancelado - Pedido con estado CANCELADO
 * @returns {Object|null} returns.mesaUpdated - Info de mesa liberada o null
 *
 * @throws {HttpError} 404 - Pedido no encontrado
 * @throws {HttpError} 400 - No se puede cancelar un pedido ya cobrado
 */
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
      // Optimize N+1 query: Revert stock movements in parallel
      const salidaMovements = pedido.movimientos.filter(mov => mov.tipo === 'SALIDA');

      if (salidaMovements.length > 0) {
        await Promise.all([
          // Restore stock for all ingredientes in parallel
          ...salidaMovements.map(mov =>
            tx.ingrediente.update({
              where: { id: mov.ingredienteId },
              data: { stockActual: { increment: toNumber(mov.cantidad) } }
            })
          ),
          // Create reversal movements in batch
          tx.movimientoStock.createMany({
            data: salidaMovements.map(mov => ({
              ingredienteId: mov.ingredienteId,
              tipo: 'ENTRADA',
              cantidad: mov.cantidad,
              motivo: `Cancelación pedido #${pedido.id}`,
              pedidoId: pedido.id
            }))
          })
        ]);
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
  /**
   * Lista pedidos con filtros opcionales.
   *
   * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma
   * @param {Object} query - Filtros de búsqueda
   * @param {string} [query.estado] - Filtrar por estado
   * @param {string} [query.tipo] - Filtrar por tipo (MESA, DELIVERY, MOSTRADOR)
   * @param {number} [query.mesaId] - Filtrar por mesa
   * @param {string} [query.fecha] - Filtrar por fecha (formato YYYY-MM-DD)
   *
   * @returns {Promise<Array>} Lista de pedidos con items, mesa, usuario y pagos
   */
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

  /**
   * Obtiene un pedido por ID con todas sus relaciones.
   *
   * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma
   * @param {number} id - ID del pedido
   *
   * @returns {Promise<Object>} Pedido con mesa, usuario, items, pagos e impresión
   *
   * @throws {HttpError} 404 - Pedido no encontrado
   */
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
