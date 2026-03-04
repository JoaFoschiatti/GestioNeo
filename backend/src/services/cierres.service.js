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
    propinas: 0,
    total: 0
  };

  for (const pago of pagos) {
    const monto = toNumber(pago.monto);
    totales.total = sumMoney(totales.total, monto);

    if (pago.propina) {
      totales.propinas = sumMoney(totales.propinas, toNumber(pago.propina));
    }

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
      totalPropinas: ventas.propinas,
      efectivoFisico: efectivoContado,
      diferencia,
      estado: 'CERRADO',
      observaciones: observaciones || null
    },
    include: {
      usuario: { select: { nombre: true } }
    }
  });

  // Reparto de propinas entre mozos que trabajaron durante el turno
  let repartoPropinas = [];
  if (ventas.propinas > 0) {
    const mozosDelTurno = await prisma.empleado.findMany({
      where: {
        rol: 'MOZO',
        activo: true,
        fichajes: {
          some: {
            entrada: { gte: caja.horaApertura }
          }
        }
      },
      select: { id: true, nombre: true, apellido: true }
    });

    if (mozosDelTurno.length > 0) {
      const montoPorMozo = Math.floor((ventas.propinas / mozosDelTurno.length) * 100) / 100;
      // El residuo se asigna al primer mozo
      const residuo = Math.round((ventas.propinas - montoPorMozo * mozosDelTurno.length) * 100) / 100;

      repartoPropinas = await Promise.all(
        mozosDelTurno.map((mozo, idx) =>
          prisma.repartoPropina.create({
            data: {
              cierreId: id,
              empleadoId: mozo.id,
              monto: idx === 0 ? sumMoney(montoPorMozo, residuo) : montoPorMozo
            }
          }).then(reparto => ({
            ...reparto,
            empleado: { nombre: mozo.nombre, apellido: mozo.apellido }
          }))
        )
      );
    }
  }

  return {
    caja: cajaCerrada,
    resumen: {
      fondoInicial: toNumber(caja.fondoInicial),
      ventasEfectivo: ventas.efectivo,
      ventasTarjeta: ventas.tarjeta,
      ventasMercadoPago: ventas.mercadopago,
      totalPropinas: ventas.propinas,
      totalVentas: ventas.total,
      efectivoEsperado,
      efectivoContado,
      diferencia,
      repartoPropinas
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
      usuario: { select: { nombre: true } },
      repartoPropinas: {
        include: { empleado: { select: { nombre: true, apellido: true } } }
      }
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

  // Preview de reparto de propinas
  let mozosDelTurno = 0;
  let estimadoPorMozo = 0;
  if (ventas.propinas > 0) {
    const mozos = await prisma.empleado.count({
      where: {
        rol: 'MOZO',
        activo: true,
        fichajes: {
          some: {
            entrada: { gte: cajaAbierta.horaApertura }
          }
        }
      }
    });
    mozosDelTurno = mozos;
    estimadoPorMozo = mozos > 0 ? Math.floor((ventas.propinas / mozos) * 100) / 100 : 0;
  }

  return {
    fondoInicial: toNumber(cajaAbierta.fondoInicial),
    ventasEfectivo: ventas.efectivo,
    ventasTarjeta: ventas.tarjeta,
    ventasMercadoPago: ventas.mercadopago,
    ventasPropinas: ventas.propinas,
    totalVentas: ventas.total,
    efectivoEsperado,
    horaApertura: cajaAbierta.horaApertura,
    propinas: {
      total: ventas.propinas,
      mozosDelTurno,
      estimadoPorMozo
    }
  };
};

module.exports = {
  obtenerActual,
  abrirCaja,
  cerrarCaja,
  listar,
  resumenActual
};

