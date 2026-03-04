/**
 * Servicio de comprobantes fiscales.
 *
 * Lógica de negocio para emitir, listar y consultar facturas electrónicas AFIP.
 * Los precios en el sistema son IVA incluido (estándar gastronomía argentina).
 */

const { solicitarCAE, obtenerUltimoComprobante, CBTE_TIPO_MAP, TIPOS_POR_CONDICION } = require('./afip.service');
const { createHttpError } = require('../utils/http-error');
const { toNumber } = require('../utils/decimal');
const { logger } = require('../utils/logger');

const IVA_21_ID = 5; // Código AFIP para alícuota 21%
const IVA_21_TASA = 1.21;

/**
 * Formatea fecha a YYYYMMDD (formato AFIP).
 */
const formatFechaAfip = (date) => {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
};

/**
 * Parsea fecha YYYYMMDD a Date.
 */
const parseFechaAfip = (str) => {
  if (!str || str.length !== 8) return null;
  return new Date(`${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`);
};

/**
 * Genera datos QR para ticket fiscal AFIP.
 */
const generarQrData = (comprobante, cuit) => {
  const qrObj = {
    ver: 1,
    fecha: formatFechaAfip(comprobante.fechaComprobante).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
    cuit: parseInt(cuit.replace(/-/g, '')),
    ptoVta: comprobante.puntoVenta,
    tipoCmp: comprobante.cbteTipo,
    nroCmp: comprobante.nroComprobante,
    importe: toNumber(comprobante.importeTotal),
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: comprobante.docTipo,
    nroDocRec: comprobante.docTipo === 99 ? 0 : parseInt(comprobante.docNro.replace(/-/g, '')) || 0,
    tipoCodAut: 'E',
    codAut: parseInt(comprobante.cae) || 0
  };

  const jsonStr = JSON.stringify(qrObj);
  const base64 = Buffer.from(jsonStr).toString('base64');
  return `https://www.afip.gob.ar/fe/qr/?p=${base64}`;
};

/**
 * Emite un comprobante fiscal (Factura A, B o C).
 */
const emitirComprobante = async (prisma, datos) => {
  const { pedidoId, pagoId, tipoComprobante, docTipo, docNro, clienteNombre } = datos;

  // 1. Cargar y validar configuración fiscal
  const negocio = await prisma.negocio.findUnique({ where: { id: 1 } });
  if (!negocio?.cuit || !negocio?.condicionIva || !negocio?.puntoVenta) {
    throw createHttpError.badRequest('Configuración fiscal incompleta. Configure CUIT, condición IVA y punto de venta.');
  }

  // 2. Validar tipo comprobante según condición IVA
  const tiposPermitidos = TIPOS_POR_CONDICION[negocio.condicionIva];
  if (!tiposPermitidos || !tiposPermitidos.includes(tipoComprobante)) {
    throw createHttpError.badRequest(
      `Un ${negocio.condicionIva.replace('_', ' ')} no puede emitir ${tipoComprobante.replace('_', ' ')}`
    );
  }

  const cbteTipo = CBTE_TIPO_MAP[tipoComprobante];
  if (!cbteTipo) {
    throw createHttpError.badRequest(`Tipo de comprobante inválido: ${tipoComprobante}`);
  }

  // 3. Cargar pedido
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    include: { items: { include: { producto: true } }, mesa: true }
  });

  if (!pedido) {
    throw createHttpError.notFound('Pedido no encontrado');
  }

  // Verificar que no tenga comprobante ya emitido
  const comprobanteExistente = await prisma.comprobante.findFirst({
    where: {
      pedidoId,
      estado: 'AUTORIZADO',
      tipoComprobante: { in: ['FACTURA_A', 'FACTURA_B', 'FACTURA_C'] }
    }
  });
  if (comprobanteExistente) {
    throw createHttpError.badRequest('Este pedido ya tiene una factura autorizada');
  }

  // 4. Calcular IVA
  const total = toNumber(pedido.total);
  let importeNeto, importeIva, importeExento, ivaArray;

  const esMono = negocio.condicionIva === 'MONOTRIBUTISTA' || negocio.condicionIva === 'EXENTO';

  if (esMono) {
    // Monotributista/Exento: Factura C sin discriminar IVA
    importeNeto = total;
    importeIva = 0;
    importeExento = 0;
    ivaArray = null;
  } else {
    // Responsable Inscripto: discriminar IVA 21%
    importeNeto = Math.round((total / IVA_21_TASA) * 100) / 100;
    importeIva = Math.round((total - importeNeto) * 100) / 100;
    importeExento = 0;
    ivaArray = [{ Id: IVA_21_ID, BaseImp: importeNeto, Importe: importeIva }];
  }

  // 5. Obtener siguiente número de comprobante desde AFIP
  const ultimoNro = await obtenerUltimoComprobante(prisma, negocio.puntoVenta, cbteTipo);
  const nroComprobante = ultimoNro + 1;

  const fechaHoy = new Date();

  // 6. Crear comprobante en estado PENDIENTE
  let comprobante = await prisma.comprobante.create({
    data: {
      tipoComprobante,
      puntoVenta: negocio.puntoVenta,
      nroComprobante,
      cbteTipo,
      concepto: 1,
      docTipo,
      docNro: String(docNro),
      clienteNombre: clienteNombre || null,
      importeTotal: total,
      importeNeto,
      importeIva,
      importeExento,
      importeTributos: 0,
      iva: ivaArray,
      estado: 'PENDIENTE',
      fechaComprobante: fechaHoy,
      moneda: 'PES',
      cotizacion: 1,
      pedidoId,
      pagoId: pagoId || null
    }
  });

  // 7. Solicitar CAE a AFIP
  try {
    const resultado = await solicitarCAE(prisma, {
      puntoVenta: negocio.puntoVenta,
      cbteTipo,
      concepto: 1,
      docTipo,
      docNro: String(docNro).replace(/-/g, ''),
      nroComprobante,
      fechaComprobante: formatFechaAfip(fechaHoy),
      importeTotal: total,
      importeNeto,
      importeIva,
      importeExento: 0,
      importeTributos: 0,
      iva: ivaArray,
      moneda: 'PES',
      cotizacion: 1
    });

    // 8. Actualizar comprobante con resultado
    const nuevoEstado = resultado.resultado === 'A' ? 'AUTORIZADO' : 'RECHAZADO';
    const qrData = resultado.cae ? generarQrData({
      ...comprobante,
      cae: resultado.cae,
      cbteTipo
    }, negocio.cuit) : null;

    comprobante = await prisma.comprobante.update({
      where: { id: comprobante.id },
      data: {
        cae: resultado.cae,
        caeVencimiento: parseFechaAfip(resultado.caeFchVto),
        estado: nuevoEstado,
        resultado: resultado.resultado,
        observaciones: resultado.observaciones,
        errores: resultado.errores?.length ? resultado.errores : undefined,
        qrData
      }
    });

    if (nuevoEstado === 'RECHAZADO') {
      logger.warn('Comprobante rechazado por AFIP', { id: comprobante.id, obs: resultado.observaciones });
    }
  } catch (err) {
    // AFIP falló - marcar como ERROR para reintentar después
    comprobante = await prisma.comprobante.update({
      where: { id: comprobante.id },
      data: {
        estado: 'ERROR',
        observaciones: err.message
      }
    });
    logger.error('Error solicitando CAE', { comprobanteId: comprobante.id, error: err.message });
  }

  return comprobante;
};

/**
 * Shortcut para emitir factura de Consumidor Final.
 */
const emitirConsumidorFinal = async (prisma, datos) => {
  const { pedidoId, pagoId } = datos;

  const negocio = await prisma.negocio.findUnique({ where: { id: 1 } });
  if (!negocio?.condicionIva) {
    throw createHttpError.badRequest('Condición IVA no configurada');
  }

  // Determinar tipo según condición IVA
  const tipoComprobante = negocio.condicionIva === 'RESPONSABLE_INSCRIPTO'
    ? 'FACTURA_B'
    : 'FACTURA_C';

  return emitirComprobante(prisma, {
    pedidoId,
    pagoId,
    tipoComprobante,
    docTipo: 99,
    docNro: '0',
    clienteNombre: null
  });
};

/**
 * Lista comprobantes con filtros y paginación.
 */
const listarComprobantes = async (prisma, filtros = {}) => {
  const {
    fechaDesde, fechaHasta, tipoComprobante, estado,
    pedidoId, page = 1, limit = 20
  } = filtros;

  const where = {};

  if (fechaDesde || fechaHasta) {
    where.fechaComprobante = {};
    if (fechaDesde) where.fechaComprobante.gte = new Date(fechaDesde);
    if (fechaHasta) where.fechaComprobante.lte = new Date(fechaHasta);
  }
  if (tipoComprobante) where.tipoComprobante = tipoComprobante;
  if (estado) where.estado = estado;
  if (pedidoId) where.pedidoId = parseInt(pedidoId);

  const skip = (page - 1) * limit;

  const [comprobantes, total] = await Promise.all([
    prisma.comprobante.findMany({
      where,
      include: {
        pedido: { select: { id: true, tipo: true, mesaId: true, clienteNombre: true, total: true } },
        pago: { select: { id: true, metodo: true, monto: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.comprobante.count({ where })
  ]);

  return {
    comprobantes,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
};

/**
 * Obtiene un comprobante por ID.
 */
const obtenerComprobante = async (prisma, id) => {
  const comprobante = await prisma.comprobante.findUnique({
    where: { id: parseInt(id) },
    include: {
      pedido: { include: { items: { include: { producto: true } }, mesa: true } },
      pago: true,
      notasCredito: true
    }
  });

  if (!comprobante) {
    throw createHttpError.notFound('Comprobante no encontrado');
  }

  return comprobante;
};

/**
 * Obtiene comprobantes de un pedido.
 */
const obtenerComprobantePorPedido = async (prisma, pedidoId) => {
  return prisma.comprobante.findMany({
    where: { pedidoId: parseInt(pedidoId) },
    orderBy: { createdAt: 'desc' }
  });
};

/**
 * Reintenta solicitar CAE para un comprobante en estado ERROR.
 */
const reintentarComprobante = async (prisma, id) => {
  const comprobante = await prisma.comprobante.findUnique({
    where: { id: parseInt(id) }
  });

  if (!comprobante) {
    throw createHttpError.notFound('Comprobante no encontrado');
  }

  if (comprobante.estado !== 'ERROR') {
    throw createHttpError.badRequest('Solo se pueden reintentar comprobantes en estado ERROR');
  }

  const negocio = await prisma.negocio.findUnique({ where: { id: 1 } });
  if (!negocio?.cuit) {
    throw createHttpError.badRequest('CUIT no configurado');
  }

  try {
    const resultado = await solicitarCAE(prisma, {
      puntoVenta: comprobante.puntoVenta,
      cbteTipo: comprobante.cbteTipo,
      concepto: comprobante.concepto,
      docTipo: comprobante.docTipo,
      docNro: String(comprobante.docNro).replace(/-/g, ''),
      nroComprobante: comprobante.nroComprobante,
      fechaComprobante: formatFechaAfip(comprobante.fechaComprobante),
      importeTotal: toNumber(comprobante.importeTotal),
      importeNeto: toNumber(comprobante.importeNeto),
      importeIva: toNumber(comprobante.importeIva),
      importeExento: toNumber(comprobante.importeExento),
      importeTributos: toNumber(comprobante.importeTributos),
      iva: comprobante.iva,
      moneda: comprobante.moneda,
      cotizacion: toNumber(comprobante.cotizacion)
    });

    const nuevoEstado = resultado.resultado === 'A' ? 'AUTORIZADO' : 'RECHAZADO';
    const qrData = resultado.cae ? generarQrData({
      ...comprobante,
      cae: resultado.cae
    }, negocio.cuit) : null;

    return prisma.comprobante.update({
      where: { id: comprobante.id },
      data: {
        cae: resultado.cae,
        caeVencimiento: parseFechaAfip(resultado.caeFchVto),
        estado: nuevoEstado,
        resultado: resultado.resultado,
        observaciones: resultado.observaciones,
        errores: resultado.errores?.length ? resultado.errores : undefined,
        qrData
      }
    });
  } catch (err) {
    await prisma.comprobante.update({
      where: { id: comprobante.id },
      data: { observaciones: `Reintento fallido: ${err.message}` }
    });
    throw err;
  }
};

module.exports = {
  emitirComprobante,
  emitirConsumidorFinal,
  listarComprobantes,
  obtenerComprobante,
  obtenerComprobantePorPedido,
  reintentarComprobante,
  formatFechaAfip,
  generarQrData
};
