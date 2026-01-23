const eventBus = require('../services/event-bus');
const printService = require('../services/print.service');
const { getPrisma } = require('../utils/get-prisma');
const pedidosService = require('../services/pedidos.service');
const { createHttpError } = require('../utils/http-error');

const emitPedidoUpdated = (pedido) => {
  if (!pedido) return;
  eventBus.publish('pedido.updated', {
    tenantId: pedido.tenantId,
    id: pedido.id,
    estado: pedido.estado,
    tipo: pedido.tipo,
    mesaId: pedido.mesaId || null,
    updatedAt: pedido.updatedAt || new Date().toISOString()
  });
};

const emitMesaUpdated = (tenantId, mesaId, estado) => {
  if (!mesaId) return;
  eventBus.publish('mesa.updated', {
    tenantId,
    mesaId,
    estado,
    updatedAt: new Date().toISOString()
  });
};

// Listar pedidos
const listar = async (req, res) => {
  const prisma = getPrisma(req);
  const pedidos = await pedidosService.listar(prisma, req.query);
  res.json(pedidos);
};

// Obtener pedido por ID
const obtener = async (req, res) => {
  const prisma = getPrisma(req);
  const { id } = req.params;
  const pedido = await pedidosService.obtener(prisma, id);
  res.json(pedido);
};

// Crear pedido
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
    emitMesaUpdated(req.tenantId, mesaUpdated.mesaId, mesaUpdated.estado);
  }

  emitPedidoUpdated(pedido);
  res.status(201).json(pedido);
};

// Cambiar estado del pedido
const cambiarEstado = async (req, res) => {
  const prisma = getPrisma(req);
  const { id } = req.params;
  const { estado } = req.body;
  const usuarioRol = req.usuario.rol;

  // MOZO solo puede cambiar a ENTREGADO
  if (usuarioRol === 'MOZO' && estado !== 'ENTREGADO') {
    throw createHttpError.forbidden('No tienes permiso para cambiar a este estado');
  }

  const { pedidoAntes, pedidoActualizado, shouldPrint, mesaUpdates, productosAgotados } =
    await pedidosService.cambiarEstadoPedido(prisma, { pedidoId: id, estado });

  for (const update of mesaUpdates) {
    emitMesaUpdated(req.tenantId, update.mesaId, update.estado);
  }

  for (const producto of productosAgotados) {
    eventBus.publish('producto.agotado', {
      tenantId: req.tenantId,
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
        tenantId: req.tenantId,
        pedidoId: pedidoAntes.id,
        ok: 0,
        total: impresion.total
      });
    } catch (printError) {
      // eslint-disable-next-line no-console
      console.error('Error al encolar impresion:', printError);
    }
  }

  emitPedidoUpdated(pedidoActualizado);
  res.json({ ...pedidoActualizado, impresion });
};

// Agregar items a pedido existente
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

// Cancelar pedido
const cancelar = async (req, res) => {
  const prisma = getPrisma(req);
  const { id } = req.params;
  const { motivo } = req.body;

  const { pedidoCancelado, mesaUpdated } = await pedidosService.cancelarPedido(prisma, {
    pedidoId: id,
    motivo
  });

  if (mesaUpdated) {
    emitMesaUpdated(req.tenantId, mesaUpdated.mesaId, mesaUpdated.estado);
  }

  emitPedidoUpdated(pedidoCancelado);
  res.json(pedidoCancelado);
};

// Pedidos pendientes para cocina
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

// Pedidos delivery para el repartidor
const pedidosDelivery = async (req, res) => {
  const prisma = getPrisma(req);
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
