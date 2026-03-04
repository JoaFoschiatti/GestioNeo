const { createHttpError } = require('../utils/http-error');
const { toNumber, sumMoney, subtractMoney } = require('../utils/decimal');

const registrarPago = async (prisma, payload) => {
  const { pedidoId, monto, metodo, referencia, comprobante, idempotencyKey, propina } = payload;

  // Usar nivel de aislamiento serializable para prevenir race conditions en pagos concurrentes
  const result = await prisma.$transaction(async (tx) => {
    if (idempotencyKey) {
      const pagoExistentePorKey = await tx.pago.findUnique({
        where: { idempotencyKey }
      });

      if (pagoExistentePorKey) {
        if (pagoExistentePorKey.pedidoId !== pedidoId) {
          throw createHttpError.badRequest('Idempotency key ya utilizada para otro pedido');
        }

        const pedidoExistente = await tx.pedido.findUnique({
          where: { id: pedidoId },
          include: { pagos: true, mesa: true }
        });

        if (!pedidoExistente) {
          throw createHttpError.notFound('Pedido no encontrado');
        }

        const pagosAprobadosExistentes = pedidoExistente.pagos.filter(p => p.estado === 'APROBADO');
        const totalPagadoExistente = sumMoney(...pagosAprobadosExistentes.map(p => p.monto));
        const pendienteExistente = Math.max(0, subtractMoney(pedidoExistente.total, totalPagadoExistente));

        return {
          pago: pagoExistentePorKey,
          pedido: pedidoExistente,
          totalPagado: totalPagadoExistente,
          pendiente: pendienteExistente,
          esperandoTransferencia: pagoExistentePorKey.metodo === 'TRANSFERENCIA' && pagoExistentePorKey.estado === 'PENDIENTE',
          idempotentReplay: true
        };
      }
    }

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

    // Para pagos normales, solo contamos los APROBADOS
    // Para calcular pendiente, ignoramos pagos de TRANSFERENCIA que están PENDIENTES
    const pagosAprobados = pedido.pagos.filter(p => p.estado === 'APROBADO');
    const totalPagado = sumMoney(...pagosAprobados.map(p => p.monto));
    const pendiente = subtractMoney(pedido.total, totalPagado);

    if (toNumber(monto) > pendiente + 0.01) {
      throw createHttpError.badRequest(`El monto excede el pendiente ($${pendiente.toFixed(2)})`);
    }

    // Si es TRANSFERENCIA, el pago queda PENDIENTE esperando la transferencia
    const esTransferencia = metodo === 'TRANSFERENCIA';
    const estadoPago = esTransferencia ? 'PENDIENTE' : 'APROBADO';

    const pago = await tx.pago.create({
      data: {
        pedidoId,
        monto,
        metodo,
        referencia: esTransferencia ? `ESPERANDO-TRANSF-${pedidoId}` : referencia,
        comprobante,
        estado: estadoPago,
        idempotencyKey: idempotencyKey || undefined,
        propina: propina || null
      }
    });

    // Solo contar como pagado si el pago está APROBADO
    const nuevoTotalPagado = esTransferencia ? totalPagado : sumMoney(totalPagado, monto);

    // Solo marcar como cobrado si no es transferencia y el total está cubierto
    if (!esTransferencia && nuevoTotalPagado >= subtractMoney(pedido.total, 0.01)) {
      await tx.pedido.update({
        where: { id: pedidoId },
        data: { estado: 'COBRADO' }
      });

      if (pedido.mesaId) {
        const mesa = pedido.mesa;
        if (mesa?.grupoMesaId) {
          // Mesa en grupo: verificar si TODOS los pedidos del grupo están cobrados
          const pedidosActivosGrupo = await tx.pedido.count({
            where: {
              mesa: { grupoMesaId: mesa.grupoMesaId },
              estado: { notIn: ['COBRADO', 'CANCELADO'] }
            }
          });
          if (pedidosActivosGrupo === 0) {
            // Todos cobrados: liberar todas las mesas y desagrupar
            await tx.mesa.updateMany({
              where: { grupoMesaId: mesa.grupoMesaId },
              data: { estado: 'LIBRE', grupoMesaId: null }
            });
          }
        } else {
          await tx.mesa.update({
            where: { id: pedido.mesaId },
            data: { estado: 'LIBRE' }
          });
        }
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
      pendiente: Math.max(0, subtractMoney(pedidoActualizado?.total || 0, nuevoTotalPagado)),
      esperandoTransferencia: esTransferencia,
      idempotentReplay: false
    };
  }, {
    isolationLevel: 'Serializable'
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

  const totalPagado = sumMoney(...pagos.map(p => p.monto));
  const totalPedido = toNumber(pedido?.total || 0);

  return {
    pagos,
    totalPedido,
    totalPagado,
    pendiente: Math.max(0, subtractMoney(totalPedido, totalPagado))
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

/**
 * Completa un pedido y libera la mesa si el total de pagos aprobados cubre el total del pedido.
 * Usado por el webhook de MercadoPago para replicar el comportamiento del flujo manual.
 */
const completarPagoPedido = async (prisma, pedidoId) => {
  return prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({
      where: { id: pedidoId },
      include: { pagos: true, mesa: true }
    });

    if (!pedido || pedido.estado === 'COBRADO' || pedido.estado === 'CANCELADO') {
      return { pedidoActualizado: pedido, mesaLiberada: false };
    }

    const pagosAprobados = pedido.pagos.filter(p => p.estado === 'APROBADO');
    const totalPagado = sumMoney(...pagosAprobados.map(p => p.monto));

    if (totalPagado >= subtractMoney(pedido.total, 0.01)) {
      const pedidoActualizado = await tx.pedido.update({
        where: { id: pedidoId },
        data: { estado: 'COBRADO' }
      });

      let mesaLiberada = false;
      if (pedido.mesaId) {
        const mesa = pedido.mesa;
        if (mesa?.grupoMesaId) {
          const pedidosActivosGrupo = await tx.pedido.count({
            where: {
              mesa: { grupoMesaId: mesa.grupoMesaId },
              estado: { notIn: ['COBRADO', 'CANCELADO'] }
            }
          });
          if (pedidosActivosGrupo === 0) {
            await tx.mesa.updateMany({
              where: { grupoMesaId: mesa.grupoMesaId },
              data: { estado: 'LIBRE', grupoMesaId: null }
            });
            mesaLiberada = true;
          }
        } else {
          await tx.mesa.update({
            where: { id: pedido.mesaId },
            data: { estado: 'LIBRE' }
          });
          mesaLiberada = true;
        }
      }

      return { pedidoActualizado, mesaLiberada, mesaId: pedido.mesaId };
    }

    return { pedidoActualizado: pedido, mesaLiberada: false };
  });
};

module.exports = {
  registrarPago,
  listarPagosPedido,
  crearPreferenciaMercadoPagoMock,
  completarPagoPedido
};

