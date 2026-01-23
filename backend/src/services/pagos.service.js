const { createHttpError } = require('../utils/http-error');

const registrarPago = async (prisma, payload) => {
  const { pedidoId, monto, metodo, referencia, comprobante } = payload;

  const result = await prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({
      where: { id: pedidoId },
      include: { pagos: true, mesa: true }
    });

    if (!pedido) {
      throw createHttpError.notFound('Pedido no encontrado');
    }

    if (pedido.estado === 'CANCELADO') {
      throw createHttpError.badRequest('No se puede pagar un pedido cancelado');
    }

    const totalPagado = pedido.pagos.reduce((sum, p) => sum + parseFloat(p.monto), 0);
    const pendiente = parseFloat(pedido.total) - totalPagado;

    if (parseFloat(monto) > pendiente + 0.01) {
      throw createHttpError.badRequest(`El monto excede el pendiente ($${pendiente.toFixed(2)})`);
    }

    const pago = await tx.pago.create({
      data: { pedidoId, monto, metodo, referencia, comprobante }
    });

    const nuevoTotalPagado = totalPagado + parseFloat(monto);

    if (nuevoTotalPagado >= parseFloat(pedido.total) - 0.01) {
      await tx.pedido.update({
        where: { id: pedidoId },
        data: { estado: 'COBRADO' }
      });

      if (pedido.mesaId) {
        await tx.mesa.update({
          where: { id: pedido.mesaId },
          data: { estado: 'LIBRE' }
        });
      }
    }

    const pedidoActualizado = await tx.pedido.findUnique({
      where: { id: pedidoId },
      include: { pagos: true, mesa: true }
    });

    return {
      pago,
      pedido: pedidoActualizado,
      totalPagado: nuevoTotalPagado,
      pendiente: Math.max(0, parseFloat(pedidoActualizado?.total || 0) - nuevoTotalPagado)
    };
  });

  return result;
};

const listarPagosPedido = async (prisma, pedidoId) => {
  const [pagos, pedido] = await Promise.all([
    prisma.pago.findMany({
      where: { pedidoId },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: { total: true }
    })
  ]);

  const totalPagado = pagos.reduce((sum, p) => sum + parseFloat(p.monto), 0);
  const totalPedido = parseFloat(pedido?.total || 0);

  return {
    pagos,
    totalPedido,
    totalPagado,
    pendiente: Math.max(0, totalPedido - totalPagado)
  };
};

const crearPreferenciaMercadoPagoMock = async (prisma, pedidoId) => {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    include: { items: { include: { producto: true } } }
  });

  if (!pedido) {
    throw createHttpError.notFound('Pedido no encontrado');
  }

  const preferencia = {
    id: `PREF_${pedidoId}_${Date.now()}`,
    init_point: `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=MOCK_${pedidoId}`,
    sandbox_init_point: `https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=MOCK_${pedidoId}`
  };

  return {
    preferencia,
    message: 'Para integración real, configurar MERCADOPAGO_ACCESS_TOKEN en .env'
  };
};

module.exports = {
  registrarPago,
  listarPagosPedido,
  crearPreferenciaMercadoPagoMock
};

