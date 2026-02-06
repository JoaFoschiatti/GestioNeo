const { createHttpError } = require('../utils/http-error');
const { toNumber, sumMoney, subtractMoney } = require('../utils/decimal');

const calcularVentasDesdeFecha = async (prisma, desde) => {
  const pagos = await prisma.pago.findMany({
    where: {
      createdAt: { gte: desde },
      estado: 'APROBADO'
    }
  });

  const totales = {
    efectivo: 0,
    tarjeta: 0,
    mercadopago: 0,
    total: 0
  };

  for (const pago of pagos) {
    const monto = toNumber(pago.monto);
    totales.total = sumMoney(totales.total, monto);

    switch (pago.metodo) {
      case 'EFECTIVO':
        totales.efectivo = sumMoney(totales.efectivo, monto);
        break;
      case 'TARJETA':
        totales.tarjeta = sumMoney(totales.tarjeta, monto);
        break;
      case 'MERCADOPAGO':
        totales.mercadopago = sumMoney(totales.mercadopago, monto);
        break;
    }
  }

  return totales;
};

const obtenerActual = async (prisma) => {
  const cajaAbierta = await prisma.cierreCaja.findFirst({
    where: {
      estado: 'ABIERTO'
    },
    include: {
      usuario: { select: { nombre: true, email: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!cajaAbierta) {
    return { cajaAbierta: false, mensaje: 'No hay caja abierta' };
  }

  const ventas = await calcularVentasDesdeFecha(prisma, cajaAbierta.horaApertura);

  return {
    cajaAbierta: true,
    caja: {
      ...cajaAbierta,
      ventasActuales: ventas
    }
  };
};

const abrirCaja = async (prisma, usuarioId, fondoInicial) => {
  const cajaAbierta = await prisma.cierreCaja.findFirst({
    where: { estado: 'ABIERTO' }
  });

  if (cajaAbierta) {
    throw createHttpError.badRequest('Ya existe una caja abierta. Debe cerrarla primero.');
  }

  const ahora = new Date();
  const hoy = new Date(ahora);
  hoy.setHours(0, 0, 0, 0);

  return prisma.cierreCaja.create({
    data: {
      usuarioId,
      fecha: hoy,
      horaApertura: ahora,
      fondoInicial: toNumber(fondoInicial),
      estado: 'ABIERTO'
    },
    include: {
      usuario: { select: { nombre: true } }
    }
  });
};

const cerrarCaja = async (prisma, id, efectivoFisico, observaciones) => {
  const caja = await prisma.cierreCaja.findUnique({
    where: { id }
  });

  if (!caja) {
    throw createHttpError.notFound('Caja no encontrada');
  }

  if (caja.estado === 'CERRADO') {
    throw createHttpError.badRequest('Esta caja ya está cerrada');
  }

  const ventas = await calcularVentasDesdeFecha(prisma, caja.horaApertura);

  const efectivoEsperado = sumMoney(caja.fondoInicial, ventas.efectivo);
  const efectivoContado = toNumber(efectivoFisico);
  const diferencia = subtractMoney(efectivoContado, efectivoEsperado);

  const cajaCerrada = await prisma.cierreCaja.update({
    where: { id },
    data: {
      horaCierre: new Date(),
      totalEfectivo: ventas.efectivo,
      totalTarjeta: ventas.tarjeta,
      totalMP: ventas.mercadopago,
      efectivoFisico: efectivoContado,
      diferencia,
      estado: 'CERRADO',
      observaciones: observaciones || null
    },
    include: {
      usuario: { select: { nombre: true } }
    }
  });

  return {
    caja: cajaCerrada,
    resumen: {
      fondoInicial: toNumber(caja.fondoInicial),
      ventasEfectivo: ventas.efectivo,
      ventasTarjeta: ventas.tarjeta,
      ventasMercadoPago: ventas.mercadopago,
      totalVentas: ventas.total,
      efectivoEsperado,
      efectivoContado,
      diferencia
    }
  };
};

const listar = async (prisma, query) => {
  const { fechaDesde, fechaHasta, limit = 30 } = query;

  const where = {};

  if (fechaDesde) {
    where.fecha = { ...where.fecha, gte: new Date(fechaDesde) };
  }
  if (fechaHasta) {
    where.fecha = { ...where.fecha, lte: new Date(fechaHasta) };
  }

  return prisma.cierreCaja.findMany({
    where,
    include: {
      usuario: { select: { nombre: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
};

const resumenActual = async (prisma) => {
  const cajaAbierta = await prisma.cierreCaja.findFirst({
    where: { estado: 'ABIERTO' },
    orderBy: { createdAt: 'desc' }
  });

  if (!cajaAbierta) {
    throw createHttpError.badRequest('No hay caja abierta');
  }

  const ventas = await calcularVentasDesdeFecha(prisma, cajaAbierta.horaApertura);
  const efectivoEsperado = sumMoney(cajaAbierta.fondoInicial, ventas.efectivo);

  return {
    fondoInicial: toNumber(cajaAbierta.fondoInicial),
    ventasEfectivo: ventas.efectivo,
    ventasTarjeta: ventas.tarjeta,
    ventasMercadoPago: ventas.mercadopago,
    totalVentas: ventas.total,
    efectivoEsperado,
    horaApertura: cajaAbierta.horaApertura
  };
};

module.exports = {
  obtenerActual,
  abrirCaja,
  cerrarCaja,
  listar,
  resumenActual
};

