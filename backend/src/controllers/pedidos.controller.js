const { PrismaClient } = require('@prisma/client');
const eventBus = require('../services/event-bus');
const printService = require('../services/print.service');
const prisma = new PrismaClient();

const emitPedidoUpdated = (pedido) => {
  if (!pedido) return;
  eventBus.publish('pedido.updated', {
    id: pedido.id,
    estado: pedido.estado,
    tipo: pedido.tipo,
    mesaId: pedido.mesaId || null,
    updatedAt: pedido.updatedAt || new Date().toISOString()
  });
};

const emitMesaUpdated = (mesaId, estado) => {
  if (!mesaId) return;
  eventBus.publish('mesa.updated', {
    mesaId,
    estado,
    updatedAt: new Date().toISOString()
  });
};

// Listar pedidos
const listar = async (req, res) => {
  try {
    const { estado, tipo, fecha, mesaId } = req.query;

    const where = {};
    if (estado) where.estado = estado;
    if (tipo) where.tipo = tipo;
    if (mesaId) where.mesaId = parseInt(mesaId);
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

    const pedidosConImpresion = pedidos.map(pedido => {
      const impresion = printService.getLatestPrintSummary(pedido.printJobs || []);
      const { printJobs, ...rest } = pedido;
      return { ...rest, impresion };
    });

    res.json(pedidosConImpresion);
  } catch (error) {
    console.error('Error al listar pedidos:', error);
    res.status(500).json({ error: { message: 'Error al obtener pedidos' } });
  }
};

// Obtener pedido por ID
const obtener = async (req, res) => {
  try {
    const { id } = req.params;

    const pedido = await prisma.pedido.findUnique({
      where: { id: parseInt(id) },
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
      return res.status(404).json({ error: { message: 'Pedido no encontrado' } });
    }

    const impresion = printService.getLatestPrintSummary(pedido.printJobs || []);
    const { printJobs, ...rest } = pedido;
    res.json({ ...rest, impresion });
  } catch (error) {
    console.error('Error al obtener pedido:', error);
    res.status(500).json({ error: { message: 'Error al obtener pedido' } });
  }
};

// Crear pedido
const crear = async (req, res) => {
  try {
    const { tipo, mesaId, items, clienteNombre, clienteTelefono, clienteDireccion, observaciones } = req.body;

    // Validaciones
    if (!items || items.length === 0) {
      return res.status(400).json({ error: { message: 'El pedido debe tener al menos un item' } });
    }

    if (tipo === 'MESA' && !mesaId) {
      return res.status(400).json({ error: { message: 'Mesa requerida para pedidos de tipo MESA' } });
    }

    // Calcular totales
    let subtotal = 0;
    const itemsConPrecio = [];
    const itemsModificadores = []; // Almacenar modificadores para crear después

    for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
      const item = items[itemIdx];
      const producto = await prisma.producto.findUnique({ where: { id: item.productoId } });
      if (!producto) {
        return res.status(400).json({ error: { message: `Producto ${item.productoId} no encontrado` } });
      }
      if (!producto.disponible) {
        return res.status(400).json({ error: { message: `Producto "${producto.nombre}" no está disponible` } });
      }

      // Calcular precio de modificadores
      let precioModificadores = 0;
      if (item.modificadores && item.modificadores.length > 0) {
        const mods = await prisma.modificador.findMany({
          where: { id: { in: item.modificadores } }
        });
        precioModificadores = mods.reduce((sum, m) => sum + parseFloat(m.precio), 0);
        itemsModificadores.push({ itemIdx, modificadores: mods });
      }

      const precioUnitarioConMods = parseFloat(producto.precio) + precioModificadores;
      const itemSubtotal = precioUnitarioConMods * item.cantidad;
      subtotal += itemSubtotal;

      itemsConPrecio.push({
        productoId: item.productoId,
        cantidad: item.cantidad,
        precioUnitario: precioUnitarioConMods,
        subtotal: itemSubtotal,
        observaciones: item.observaciones
      });
    }

    // Si es pedido de mesa, actualizar estado de la mesa
    if (tipo === 'MESA' && mesaId) {
      await prisma.mesa.update({
        where: { id: mesaId },
        data: { estado: 'OCUPADA' }
      });
      emitMesaUpdated(mesaId, 'OCUPADA');
    }

    const pedido = await prisma.pedido.create({
      data: {
        tipo,
        mesaId: tipo === 'MESA' ? mesaId : null,
        usuarioId: req.usuario.id,
        clienteNombre,
        clienteTelefono,
        clienteDireccion,
        subtotal,
        total: subtotal,
        observaciones,
        items: { create: itemsConPrecio }
      },
      include: {
        mesa: true,
        usuario: { select: { nombre: true } },
        items: { include: { producto: true } }
      }
    });

    // Crear modificadores de items
    for (const { itemIdx, modificadores } of itemsModificadores) {
      const pedidoItem = pedido.items[itemIdx];
      if (pedidoItem) {
        await prisma.pedidoItemModificador.createMany({
          data: modificadores.map(m => ({
            pedidoItemId: pedidoItem.id,
            modificadorId: m.id,
            precio: m.precio
          }))
        });
      }
    }

    // Recargar pedido con modificadores
    const pedidoCompleto = await prisma.pedido.findUnique({
      where: { id: pedido.id },
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

    emitPedidoUpdated(pedidoCompleto);
    res.status(201).json(pedidoCompleto);
  } catch (error) {
    console.error('Error al crear pedido:', error);
    res.status(500).json({ error: { message: 'Error al crear pedido' } });
  }
};

// Cambiar estado del pedido
const cambiarEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    const usuarioRol = req.usuario.rol;

    // MOZO solo puede cambiar a ENTREGADO
    if (usuarioRol === 'MOZO' && estado !== 'ENTREGADO') {
      return res.status(403).json({
        error: { message: 'No tienes permiso para cambiar a este estado' }
      });
    }

    const pedido = await prisma.pedido.findUnique({
      where: { id: parseInt(id) },
      include: { items: { include: { producto: { include: { ingredientes: true } } } } }
    });

    if (!pedido) {
      return res.status(404).json({ error: { message: 'Pedido no encontrado' } });
    }

    // Si pasa a EN_PREPARACION, descontar stock
    if (estado === 'EN_PREPARACION' && pedido.estado === 'PENDIENTE') {
      for (const item of pedido.items) {
        for (const prodIng of item.producto.ingredientes) {
          const cantidadDescontar = parseFloat(prodIng.cantidad) * item.cantidad;

          await prisma.ingrediente.update({
            where: { id: prodIng.ingredienteId },
            data: { stockActual: { decrement: cantidadDescontar } }
          });

          await prisma.movimientoStock.create({
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

      // Verificar ingredientes agotados y marcar productos como no disponibles
      const ingredientesAgotados = await prisma.ingrediente.findMany({
        where: { stockActual: { lte: 0 } },
        select: { id: true, nombre: true }
      });

      if (ingredientesAgotados.length > 0) {
        const idsIngredientesAgotados = ingredientesAgotados.map(i => i.id);

        // Buscar productos que usan estos ingredientes
        const productosAfectados = await prisma.producto.findMany({
          where: {
            disponible: true,
            ingredientes: {
              some: { ingredienteId: { in: idsIngredientesAgotados } }
            }
          },
          select: { id: true, nombre: true }
        });

        if (productosAfectados.length > 0) {
          // Marcar productos como no disponibles
          await prisma.producto.updateMany({
            where: { id: { in: productosAfectados.map(p => p.id) } },
            data: { disponible: false }
          });

          // Publicar evento por cada producto agotado
          for (const producto of productosAfectados) {
            eventBus.publish('producto.agotado', {
              id: producto.id,
              nombre: producto.nombre,
              motivo: 'Ingrediente agotado',
              updatedAt: new Date().toISOString()
            });
          }

          console.log(`Productos marcados como no disponibles: ${productosAfectados.map(p => p.nombre).join(', ')}`);
        }
      }
    }

    // Si pasa a COBRADO y es de mesa, liberar la mesa
    if (estado === 'COBRADO' && pedido.mesaId) {
      await prisma.mesa.update({
        where: { id: pedido.mesaId },
        data: { estado: 'LIBRE' }
      });
      emitMesaUpdated(pedido.mesaId, 'LIBRE');
    }

    const pedidoActualizado = await prisma.pedido.update({
      where: { id: parseInt(id) },
      data: { estado },
      include: {
        mesa: true,
        usuario: { select: { nombre: true } },
        items: { include: { producto: true } }
      }
    });

    let impresion = null;
    if (estado === 'EN_PREPARACION' && pedido.estado === 'PENDIENTE') {
      try {
        impresion = await printService.enqueuePrintJobs(pedido.id);
        eventBus.publish('impresion.updated', {
          pedidoId: pedido.id,
          ok: 0,
          total: impresion.total
        });
      } catch (printError) {
        console.error('Error al encolar impresion:', printError);
      }
    }

    emitPedidoUpdated(pedidoActualizado);
    res.json({ ...pedidoActualizado, impresion });
  } catch (error) {
    console.error('Error al cambiar estado de pedido:', error);
    res.status(500).json({ error: { message: 'Error al cambiar estado' } });
  }
};

// Agregar items a pedido existente
const agregarItems = async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;

    const pedido = await prisma.pedido.findUnique({ where: { id: parseInt(id) } });
    if (!pedido) {
      return res.status(404).json({ error: { message: 'Pedido no encontrado' } });
    }

    if (['COBRADO', 'CANCELADO'].includes(pedido.estado)) {
      return res.status(400).json({ error: { message: 'No se pueden agregar items a este pedido' } });
    }

    let subtotalNuevo = 0;
    const itemsConPrecio = [];

    for (const item of items) {
      const producto = await prisma.producto.findUnique({ where: { id: item.productoId } });
      if (!producto || !producto.disponible) {
        return res.status(400).json({ error: { message: `Producto no disponible` } });
      }

      const itemSubtotal = parseFloat(producto.precio) * item.cantidad;
      subtotalNuevo += itemSubtotal;

      itemsConPrecio.push({
        pedidoId: parseInt(id),
        productoId: item.productoId,
        cantidad: item.cantidad,
        precioUnitario: producto.precio,
        subtotal: itemSubtotal,
        observaciones: item.observaciones
      });
    }

    await prisma.pedidoItem.createMany({ data: itemsConPrecio });

    const pedidoActualizado = await prisma.pedido.update({
      where: { id: parseInt(id) },
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

    emitPedidoUpdated(pedidoActualizado);
    res.json(pedidoActualizado);
  } catch (error) {
    console.error('Error al agregar items:', error);
    res.status(500).json({ error: { message: 'Error al agregar items' } });
  }
};

// Cancelar pedido
const cancelar = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    const pedido = await prisma.pedido.findUnique({
      where: { id: parseInt(id) },
      include: { movimientos: true }
    });

    if (!pedido) {
      return res.status(404).json({ error: { message: 'Pedido no encontrado' } });
    }

    if (pedido.estado === 'COBRADO') {
      return res.status(400).json({ error: { message: 'No se puede cancelar un pedido cobrado' } });
    }

    // Revertir stock si ya se había descontado
    if (pedido.estado !== 'PENDIENTE') {
      for (const mov of pedido.movimientos) {
        if (mov.tipo === 'SALIDA') {
          await prisma.ingrediente.update({
            where: { id: mov.ingredienteId },
            data: { stockActual: { increment: parseFloat(mov.cantidad) } }
          });

          await prisma.movimientoStock.create({
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
    }

    // Liberar mesa si aplica
    if (pedido.mesaId) {
      await prisma.mesa.update({
        where: { id: pedido.mesaId },
        data: { estado: 'LIBRE' }
      });
      emitMesaUpdated(pedido.mesaId, 'LIBRE');
    }

    const pedidoCancelado = await prisma.pedido.update({
      where: { id: parseInt(id) },
      data: {
        estado: 'CANCELADO',
        observaciones: pedido.observaciones
          ? `${pedido.observaciones} | CANCELADO: ${motivo || 'Sin motivo'}`
          : `CANCELADO: ${motivo || 'Sin motivo'}`
      }
    });

    emitPedidoUpdated(pedidoCancelado);
    res.json(pedidoCancelado);
  } catch (error) {
    console.error('Error al cancelar pedido:', error);
    res.status(500).json({ error: { message: 'Error al cancelar pedido' } });
  }
};

// Pedidos pendientes para cocina
const pedidosCocina = async (req, res) => {
  try {
    const pedidos = await prisma.pedido.findMany({
      where: {
        estado: { in: ['PENDIENTE', 'EN_PREPARACION'] }
      },
      include: {
        mesa: { select: { numero: true } },
        items: {
          include: {
            producto: { select: { nombre: true } },
            modificadores: { include: { modificador: { select: { nombre: true, tipo: true } } } }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(pedidos);
  } catch (error) {
    console.error('Error al obtener pedidos cocina:', error);
    res.status(500).json({ error: { message: 'Error al obtener pedidos' } });
  }
};

// Pedidos delivery para el repartidor
const pedidosDelivery = async (req, res) => {
  try {
    const pedidos = await prisma.pedido.findMany({
      where: {
        tipo: 'DELIVERY',
        estado: { in: ['PENDIENTE', 'EN_PREPARACION', 'LISTO'] }
      },
      include: {
        items: { include: { producto: { select: { nombre: true, precio: true } } } },
        usuario: { select: { nombre: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(pedidos);
  } catch (error) {
    console.error('Error al obtener pedidos delivery:', error);
    res.status(500).json({ error: { message: 'Error al obtener pedidos delivery' } });
  }
};

module.exports = {
  listar,
  obtener,
  crear,
  cambiarEstado,
  agregarItems,
  cancelar,
  pedidosCocina,
  pedidosDelivery
};
