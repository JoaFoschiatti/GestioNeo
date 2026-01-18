const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
        items: { include: { producto: { select: { nombre: true } } } },
        pagos: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(pedidos);
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
        items: { include: { producto: true } },
        pagos: true
      }
    });

    if (!pedido) {
      return res.status(404).json({ error: { message: 'Pedido no encontrado' } });
    }

    res.json(pedido);
  } catch (error) {
    console.error('Error al obtener pedido:', error);
    res.status(500).json({ error: { message: 'Error al obtener pedido' } });
  }
};

// Crear pedido
const crear = async (req, res) => {
  try {
    const { tipo, mesaId, items, clienteNombre, clienteTelefono, clienteDireccion, observaciones } = req.body;

    // Calcular totales
    let subtotal = 0;
    const itemsConPrecio = [];

    for (const item of items) {
      const producto = await prisma.producto.findUnique({ where: { id: item.productoId } });
      if (!producto) {
        return res.status(400).json({ error: { message: `Producto ${item.productoId} no encontrado` } });
      }
      if (!producto.disponible) {
        return res.status(400).json({ error: { message: `Producto "${producto.nombre}" no está disponible` } });
      }

      const itemSubtotal = parseFloat(producto.precio) * item.cantidad;
      subtotal += itemSubtotal;

      itemsConPrecio.push({
        productoId: item.productoId,
        cantidad: item.cantidad,
        precioUnitario: producto.precio,
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

    res.status(201).json(pedido);
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
    }

    // Si pasa a COBRADO y es de mesa, liberar la mesa
    if (estado === 'COBRADO' && pedido.mesaId) {
      await prisma.mesa.update({
        where: { id: pedido.mesaId },
        data: { estado: 'LIBRE' }
      });
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

    res.json(pedidoActualizado);
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
        items: { include: { producto: { select: { nombre: true } } } }
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
