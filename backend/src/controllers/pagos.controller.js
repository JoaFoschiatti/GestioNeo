const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Registrar pago
const registrarPago = async (req, res) => {
  try {
    const { pedidoId, monto, metodo, referencia, comprobante } = req.body;

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { pagos: true }
    });

    if (!pedido) {
      return res.status(404).json({ error: { message: 'Pedido no encontrado' } });
    }

    if (pedido.estado === 'CANCELADO') {
      return res.status(400).json({ error: { message: 'No se puede pagar un pedido cancelado' } });
    }

    // Calcular total pagado
    const totalPagado = pedido.pagos.reduce((sum, p) => sum + parseFloat(p.monto), 0);
    const pendiente = parseFloat(pedido.total) - totalPagado;

    if (parseFloat(monto) > pendiente + 0.01) { // pequeño margen para decimales
      return res.status(400).json({
        error: { message: `El monto excede el pendiente ($${pendiente.toFixed(2)})` }
      });
    }

    const pago = await prisma.pago.create({
      data: { pedidoId, monto, metodo, referencia, comprobante }
    });

    // Si el total pagado cubre el pedido, marcarlo como cobrado
    const nuevoTotalPagado = totalPagado + parseFloat(monto);
    if (nuevoTotalPagado >= parseFloat(pedido.total) - 0.01) {
      await prisma.pedido.update({
        where: { id: pedidoId },
        data: { estado: 'COBRADO' }
      });

      // Liberar mesa si aplica
      if (pedido.mesaId) {
        await prisma.mesa.update({
          where: { id: pedido.mesaId },
          data: { estado: 'LIBRE' }
        });
      }
    }

    const pedidoActualizado = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { pagos: true, mesa: true }
    });

    res.status(201).json({
      pago,
      pedido: pedidoActualizado,
      totalPagado: nuevoTotalPagado,
      pendiente: Math.max(0, parseFloat(pedido.total) - nuevoTotalPagado)
    });
  } catch (error) {
    console.error('Error al registrar pago:', error);
    res.status(500).json({ error: { message: 'Error al registrar pago' } });
  }
};

// Crear preferencia de MercadoPago (para delivery)
const crearPreferenciaMercadoPago = async (req, res) => {
  try {
    const { pedidoId } = req.body;

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { items: { include: { producto: true } } }
    });

    if (!pedido) {
      return res.status(404).json({ error: { message: 'Pedido no encontrado' } });
    }

    // TODO: Integrar SDK de MercadoPago real
    // Por ahora retornamos un mock para desarrollo
    const preferencia = {
      id: `PREF_${pedidoId}_${Date.now()}`,
      init_point: `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=MOCK_${pedidoId}`,
      sandbox_init_point: `https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=MOCK_${pedidoId}`
    };

    res.json({
      preferencia,
      message: 'Para integración real, configurar MERCADOPAGO_ACCESS_TOKEN en .env'
    });
  } catch (error) {
    console.error('Error al crear preferencia:', error);
    res.status(500).json({ error: { message: 'Error al crear preferencia de pago' } });
  }
};

// Webhook de MercadoPago
const webhookMercadoPago = async (req, res) => {
  try {
    const { type, data } = req.body;

    // TODO: Implementar verificación de firma y procesamiento real
    console.log('Webhook MercadoPago:', { type, data });

    if (type === 'payment') {
      // Procesar pago confirmado
      // const paymentId = data.id;
      // Buscar pedido asociado y registrar pago
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error en webhook:', error);
    res.sendStatus(500);
  }
};

// Listar pagos de un pedido
const listarPagosPedido = async (req, res) => {
  try {
    const { pedidoId } = req.params;

    const pagos = await prisma.pago.findMany({
      where: { pedidoId: parseInt(pedidoId) },
      orderBy: { createdAt: 'desc' }
    });

    const pedido = await prisma.pedido.findUnique({
      where: { id: parseInt(pedidoId) },
      select: { total: true }
    });

    const totalPagado = pagos.reduce((sum, p) => sum + parseFloat(p.monto), 0);

    res.json({
      pagos,
      totalPedido: pedido?.total || 0,
      totalPagado,
      pendiente: Math.max(0, parseFloat(pedido?.total || 0) - totalPagado)
    });
  } catch (error) {
    console.error('Error al listar pagos:', error);
    res.status(500).json({ error: { message: 'Error al obtener pagos' } });
  }
};

module.exports = {
  registrarPago,
  crearPreferenciaMercadoPago,
  webhookMercadoPago,
  listarPagosPedido
};
