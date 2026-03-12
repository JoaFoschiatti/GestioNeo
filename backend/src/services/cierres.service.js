const { createHttpError } = require('../utils/http-error');

const round2 = (n) => Math.round(n * 100) / 100;

// Mapa de metodos de pago DB -> claves internas
const METODO_KEY = { EFECTIVO: 'efectivo', TARJETA: 'tarjeta', MERCADOPAGO: 'mercadopago' };

const calcularVentasDesdeFecha = async (prisma, desde) => {
  const pagos = await prisma.pago.findMany({
    where: { createdAt: { gte: desde }, estado: 'APROBADO' }
  });

  const totales = { efectivo: 0, tarjeta: 0, mercadopago: 0, total: 0 };

  for (const pago of pagos) {
    const monto = parseFloat(pago.monto);
    totales.total += monto;
    const key = METODO_KEY[pago.metodo];
    if (key) totales[key] += monto;
  }

  totales.efectivo = round2(totales.efectivo);
  totales.tarjeta = round2(totales.tarjeta);
  totales.mercadopago = round2(totales.mercadopago);
  totales.total = round2(totales.total);

  return totales;
};

// Busca la caja abierta con sus ventas. Retorna null si no hay caja abierta.
const _getCajaAbiertaConVentas = async (prisma) => {
  const caja = await prisma.cierreCaja.findFirst({
    where: { estado: 'ABIERTO' },
    include: { usuario: { select: { nombre: true, email: true } } },
    orderBy: { createdAt: 'desc' }
  });
  if (!caja) return null;
  const ventas = await calcularVentasDesdeFecha(prisma, caja.horaApertura);
  return { caja, ventas };
};

const obtenerActual = async (prisma) => {
  const result = await _getCajaAbiertaConVentas(prisma);
  if (!result) return { cajaAbierta: false, mensaje: 'No hay caja abierta' };
  return {
    cajaAbierta: true,
    caja: { ...result.caja, ventasActuales: result.ventas }
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
      fondoInicial: parseFloat(fondoInicial) || 0,
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

  const efectivoEsperado = round2(parseFloat(caja.fondoInicial) + ventas.efectivo);
  const efectivoContado = round2(parseFloat(efectivoFisico) || 0);
  const diferencia = round2(efectivoContado - efectivoEsperado);

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
      fondoInicial: parseFloat(caja.fondoInicial),
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
  const result = await _getCajaAbiertaConVentas(prisma);
  if (!result) throw createHttpError.badRequest('No hay caja abierta');

  const { caja, ventas } = result;
  const efectivoEsperado = round2(parseFloat(caja.fondoInicial) + ventas.efectivo);

  return {
    fondoInicial: parseFloat(caja.fondoInicial),
    ventasEfectivo: ventas.efectivo,
    ventasTarjeta: ventas.tarjeta,
    ventasMercadoPago: ventas.mercadopago,
    totalVentas: ventas.total,
    efectivoEsperado,
    horaApertura: caja.horaApertura
  };
};

module.exports = {
  obtenerActual,
  abrirCaja,
  cerrarCaja,
  listar,
  resumenActual
};
