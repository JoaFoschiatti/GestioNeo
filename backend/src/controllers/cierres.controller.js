const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Obtener caja actual (abierta) del día
const obtenerActual = async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

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
      return res.json({ cajaAbierta: false, mensaje: 'No hay caja abierta' });
    }

    // Calcular totales de ventas desde la apertura
    const ventas = await calcularVentasDesdeFecha(cajaAbierta.horaApertura);

    res.json({
      cajaAbierta: true,
      caja: {
        ...cajaAbierta,
        ventasActuales: ventas
      }
    });
  } catch (error) {
    console.error('Error al obtener caja actual:', error);
    res.status(500).json({ error: { message: 'Error al obtener estado de caja' } });
  }
};

// Calcular ventas desde una fecha
const calcularVentasDesdeFecha = async (desde) => {
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
    const monto = parseFloat(pago.monto);
    totales.total += monto;

    switch (pago.metodo) {
      case 'EFECTIVO':
        totales.efectivo += monto;
        break;
      case 'TARJETA':
        totales.tarjeta += monto;
        break;
      case 'MERCADOPAGO':
        totales.mercadopago += monto;
        break;
    }
  }

  return totales;
};

// Abrir caja
const abrirCaja = async (req, res) => {
  try {
    const { fondoInicial } = req.body;
    const usuarioId = req.usuario.id;

    // Verificar que no haya caja abierta
    const cajaAbierta = await prisma.cierreCaja.findFirst({
      where: { estado: 'ABIERTO' }
    });

    if (cajaAbierta) {
      return res.status(400).json({
        error: { message: 'Ya existe una caja abierta. Debe cerrarla primero.' }
      });
    }

    const ahora = new Date();
    const hoy = new Date(ahora);
    hoy.setHours(0, 0, 0, 0);

    const caja = await prisma.cierreCaja.create({
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

    res.status(201).json(caja);
  } catch (error) {
    console.error('Error al abrir caja:', error);
    res.status(500).json({ error: { message: 'Error al abrir caja' } });
  }
};

// Cerrar caja
const cerrarCaja = async (req, res) => {
  try {
    const { id } = req.params;
    const { efectivoFisico, observaciones } = req.body;

    const caja = await prisma.cierreCaja.findUnique({
      where: { id: parseInt(id) }
    });

    if (!caja) {
      return res.status(404).json({ error: { message: 'Caja no encontrada' } });
    }

    if (caja.estado === 'CERRADO') {
      return res.status(400).json({ error: { message: 'Esta caja ya está cerrada' } });
    }

    // Calcular totales de ventas
    const ventas = await calcularVentasDesdeFecha(caja.horaApertura);

    // El efectivo esperado es: fondo inicial + ventas en efectivo
    const efectivoEsperado = parseFloat(caja.fondoInicial) + ventas.efectivo;
    const efectivoContado = parseFloat(efectivoFisico) || 0;
    const diferencia = efectivoContado - efectivoEsperado;

    const cajaCerrada = await prisma.cierreCaja.update({
      where: { id: parseInt(id) },
      data: {
        horaCierre: new Date(),
        totalEfectivo: ventas.efectivo,
        totalTarjeta: ventas.tarjeta,
        totalMP: ventas.mercadopago,
        efectivoFisico: efectivoContado,
        diferencia,
        estado: 'CERRADO',
        observaciones
      },
      include: {
        usuario: { select: { nombre: true } }
      }
    });

    res.json({
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
    });
  } catch (error) {
    console.error('Error al cerrar caja:', error);
    res.status(500).json({ error: { message: 'Error al cerrar caja' } });
  }
};

// Listar cierres (histórico)
const listar = async (req, res) => {
  try {
    const { fechaDesde, fechaHasta, limit = 30 } = req.query;

    const where = {};

    if (fechaDesde) {
      where.fecha = { ...where.fecha, gte: new Date(fechaDesde) };
    }
    if (fechaHasta) {
      where.fecha = { ...where.fecha, lte: new Date(fechaHasta) };
    }

    const cierres = await prisma.cierreCaja.findMany({
      where,
      include: {
        usuario: { select: { nombre: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });

    res.json(cierres);
  } catch (error) {
    console.error('Error al listar cierres:', error);
    res.status(500).json({ error: { message: 'Error al obtener histórico de cierres' } });
  }
};

// Obtener resumen de ventas actual (sin cerrar caja)
const resumenActual = async (req, res) => {
  try {
    const cajaAbierta = await prisma.cierreCaja.findFirst({
      where: { estado: 'ABIERTO' },
      orderBy: { createdAt: 'desc' }
    });

    if (!cajaAbierta) {
      return res.status(400).json({
        error: { message: 'No hay caja abierta' }
      });
    }

    const ventas = await calcularVentasDesdeFecha(cajaAbierta.horaApertura);
    const efectivoEsperado = parseFloat(cajaAbierta.fondoInicial) + ventas.efectivo;

    res.json({
      fondoInicial: parseFloat(cajaAbierta.fondoInicial),
      ventasEfectivo: ventas.efectivo,
      ventasTarjeta: ventas.tarjeta,
      ventasMercadoPago: ventas.mercadopago,
      totalVentas: ventas.total,
      efectivoEsperado,
      horaApertura: cajaAbierta.horaApertura
    });
  } catch (error) {
    console.error('Error al obtener resumen:', error);
    res.status(500).json({ error: { message: 'Error al obtener resumen' } });
  }
};

module.exports = {
  obtenerActual,
  abrirCaja,
  cerrarCaja,
  listar,
  resumenActual
};
