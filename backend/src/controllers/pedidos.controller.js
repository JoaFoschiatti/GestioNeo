const eventBus = require('../services/event-bus');
const printService = require('../services/print.service');
const { getPrisma } = require('../utils/get-prisma');
const pedidosService = require('../services/pedidos.service');
const { createHttpError } = require('../utils/http-error');
const { logger } = require('../utils/logger');

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

const listar = async (req, res) => {
  const prisma = getPrisma(req);
  const result = await pedidosService.listar(prisma, req.query);
  res.json(result);
};

const obtener = async (req, res) => {
  const prisma = getPrisma(req);
  const { id } = req.params;
  const pedido = await pedidosService.obtener(prisma, id);
  res.json(pedido);
};

const crear = async (req, res) => {
  const prisma = getPrisma(req);
  const { tipo, mesaId, items, clienteNombre, clienteTelefono, clienteDireccion, observaciones } = req.body;

  const { pedido, mesaUpdated } = await pedidosService.crearPedido(prisma, {
    tipo,
    mesaId: mesaId ? Number(mesaId) : null,
    items,
    clienteNombre,
    clienteTelefono,
    clienteDireccion,
    observaciones,
    usuarioId: req.usuario.id
  });

  if (mesaUpdated) {
    emitMesaUpdated(mesaUpdated.mesaId, mesaUpdated.estado);
  }

  emitPedidoUpdated(pedido);
  res.status(201).json(pedido);
};

const cambiarEstado = async (req, res) => {
  const prisma = getPrisma(req);
  const { id } = req.params;
  const { estado } = req.body;
  const usuarioRol = req.usuario.rol;

  if ((usuarioRol === 'MOZO' || usuarioRol === 'DELIVERY') && estado !== 'ENTREGADO') {
    throw createHttpError.forbidden('No tienes permiso para cambiar a este estado');
  }

  const { pedidoAntes, pedidoActualizado, shouldPrint, mesaUpdates, productosAgotados } =
    await pedidosService.cambiarEstadoPedido(prisma, { pedidoId: id, estado, usuarioId: req.usuario.id });

  for (const update of mesaUpdates) {
    emitMesaUpdated(update.mesaId, update.estado);
  }

  for (const producto of productosAgotados) {
    eventBus.publish('producto.agotado', {
      id: producto.id,
      nombre: producto.nombre,
      motivo: 'Ingrediente agotado',
      updatedAt: new Date().toISOString()
    });
  }

  let impresion = null;
  if (shouldPrint) {
    try {
      impresion = await printService.enqueuePrintJobs(prisma, pedidoAntes.id);
      eventBus.publish('impresion.updated', {
        pedidoId: pedidoAntes.id,
        ok: 0,
        total: impresion.total
      });
    } catch (printError) {
      logger.error('Error al encolar impresion:', printError);
    }
  }

  emitPedidoUpdated(pedidoActualizado);
  res.json({ ...pedidoActualizado, impresion });
};

const agregarItems = async (req, res) => {
  const prisma = getPrisma(req);
  const { id } = req.params;
  const { items } = req.body;

  const pedidoActualizado = await pedidosService.agregarItemsPedido(prisma, {
    pedidoId: id,
    items
  });

  emitPedidoUpdated(pedidoActualizado);
  res.json(pedidoActualizado);
};

const cancelar = async (req, res) => {
  const prisma = getPrisma(req);
  const { id } = req.params;
  const { motivo } = req.body;

  const { pedidoCancelado, mesaUpdated } = await pedidosService.cancelarPedido(prisma, {
    pedidoId: id,
    motivo,
    usuarioId: req.usuario.id
  });

  if (mesaUpdated) {
    emitMesaUpdated(mesaUpdated.mesaId, mesaUpdated.estado);
  }

  emitPedidoUpdated(pedidoCancelado);
  res.json(pedidoCancelado);
};

const cerrar = async (req, res) => {
  const prisma = getPrisma(req);
  const { id } = req.params;

  const { pedidoActualizado, mesaUpdated } = await pedidosService.cerrarPedido(prisma, {
    pedidoId: id,
    usuarioId: req.usuario.id
  });

  if (mesaUpdated) {
    emitMesaUpdated(mesaUpdated.mesaId, mesaUpdated.estado);
  }

  emitPedidoUpdated(pedidoActualizado);
  res.json(pedidoActualizado);
};

const pedidosCocina = async (req, res) => {
  const prisma = getPrisma(req);
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
};

const pedidosDelivery = async (req, res) => {
  const prisma = getPrisma(req);
  const where = {
    tipo: 'DELIVERY',
    estado: { in: ['PENDIENTE', 'EN_PREPARACION', 'LISTO'] }
  };

  if (req.usuario.rol === 'DELIVERY') {
    where.repartidorId = req.usuario.id;
  }

  const pedidos = await prisma.pedido.findMany({
    where,
    include: {
      items: { include: { producto: { select: { nombre: true, precio: true } } } },
      usuario: { select: { nombre: true } },
      repartidor: { select: { id: true, nombre: true } }
    },
    orderBy: { createdAt: 'asc' }
  });

  res.json(pedidos);
};

const listarRepartidores = async (req, res) => {
  const prisma = getPrisma(req);
  const repartidores = await prisma.usuario.findMany({
    where: { rol: 'DELIVERY', activo: true },
    select: { id: true, nombre: true, apellido: true }
  });
  res.json(repartidores);
};

const asignarDelivery = async (req, res) => {
  const prisma = getPrisma(req);
  const { id } = req.params;
  const { repartidorId } = req.body;

  const [pedidoExistente, repartidor] = await Promise.all([
    prisma.pedido.findUnique({ where: { id }, select: { id: true, tipo: true } }),
    prisma.usuario.findUnique({ where: { id: repartidorId }, select: { id: true, rol: true } })
  ]);

  if (!pedidoExistente) {
    throw createHttpError.notFound('Pedido no encontrado');
  }
  if (pedidoExistente.tipo !== 'DELIVERY') {
    throw createHttpError.badRequest('Solo se puede asignar repartidor a pedidos de tipo DELIVERY');
  }
  if (!repartidor || repartidor.rol !== 'DELIVERY') {
    throw createHttpError.badRequest('El usuario seleccionado no es un repartidor');
  }

  const pedido = await prisma.pedido.update({
    where: { id },
    data: { repartidorId },
    include: {
      repartidor: { select: { id: true, nombre: true } },
      mesa: true,
      usuario: { select: { nombre: true } },
      items: { include: { producto: true } }
    }
  });

  emitPedidoUpdated(pedido);
  res.json(pedido);
};

module.exports = {
  listar,
  obtener,
  crear,
  cambiarEstado,
  agregarItems,
  cancelar,
  cerrar,
  pedidosCocina,
  pedidosDelivery,
  listarRepartidores,
  asignarDelivery
};
