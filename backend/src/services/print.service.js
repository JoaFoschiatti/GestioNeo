const crypto = require('crypto');
const { createHttpError } = require('../utils/http-error');

const DEFAULT_WIDTH_MM = parseInt(process.env.PRINT_WIDTH_MM || '80', 10);
const DEFAULT_MAX_RETRIES = parseInt(process.env.PRINT_MAX_RETRIES || '3', 10);
const moneyFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const getMaxChars = (anchoMm) => {
  const width = parseInt(anchoMm || DEFAULT_WIDTH_MM, 10);
  if (width === 58) return 32;
  return 48;
};

const centerText = (text, width) => {
  const trimmed = text.trim();
  if (trimmed.length >= width) return trimmed.slice(0, width);
  const left = Math.floor((width - trimmed.length) / 2);
  const right = width - trimmed.length - left;
  return `${' '.repeat(left)}${trimmed}${' '.repeat(right)}`;
};

const wrapText = (text, width) => {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [''];

  const words = normalized.split(' ');
  const lines = [];
  let current = '';

  const pushLine = () => {
    if (current.trim()) lines.push(current.trim());
    current = '';
  };

  for (const word of words) {
    if (!current) {
      if (word.length > width) {
        const chunks = word.match(new RegExp(`.{1,${width}}`, 'g')) || [];
        lines.push(...chunks);
      } else {
        current = word;
      }
      continue;
    }

    if ((current.length + 1 + word.length) > width) {
      pushLine();
      if (word.length > width) {
        const chunks = word.match(new RegExp(`.{1,${width}}`, 'g')) || [];
        lines.push(...chunks);
      } else {
        current = word;
      }
    } else {
      current = `${current} ${word}`;
    }
  }

  pushLine();
  return lines.length ? lines : [''];
};

const formatMoney = (value) => {
  const numeric = Number(value || 0);
  return moneyFormatter.format(numeric);
};

const formatLineLeftRight = (left, right, width) => {
  const safeLeft = String(left || '');
  const safeRight = String(right || '');
  const space = width - safeLeft.length - safeRight.length;
  if (space >= 1) {
    return `${safeLeft}${' '.repeat(space)}${safeRight}`;
  }
  return `${safeLeft}\n${' '.repeat(2)}${safeRight}`;
};

const buildHeaderTitle = (pedido, tipo) => {
  if (tipo === 'COCINA') return 'COMANDA COCINA';
  if (pedido.tipo === 'MESA') return 'CONTROL DE MESA';
  if (pedido.tipo === 'DELIVERY') return 'CONTROL DELIVERY';
  return 'CONTROL MOSTRADOR';
};

const buildComandaText = (pedido, tipo, anchoMm) => {
  const maxChars = getMaxChars(anchoMm);
  const dashed = '-'.repeat(maxChars);
  const fecha = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(pedido.createdAt));
  const lineas = [];

  lineas.push(centerText(buildHeaderTitle(pedido, tipo), maxChars));
  lineas.push('');
  lineas.push(`Pedido: #${pedido.id}`);
  lineas.push(`Fecha: ${fecha}`);

  if (pedido.tipo === 'MESA' && pedido.mesa) {
    lineas.push(`Mesa: ${pedido.mesa.numero}`);
  }

  if (pedido.clienteNombre) lineas.push(`Cliente: ${pedido.clienteNombre}`);
  if (pedido.clienteTelefono) lineas.push(`Telefono: ${pedido.clienteTelefono}`);
  if (pedido.clienteDireccion) lineas.push(`Direccion: ${pedido.clienteDireccion}`);

  if (pedido.tipo === 'MOSTRADOR' && !pedido.clienteNombre) {
    lineas.push('Tipo: MOSTRADOR');
  }

  lineas.push('');
  if (tipo === 'COCINA') {
    lineas.push(dashed);
  }

  for (const item of pedido.items) {
    const nombre = item.producto?.nombre || 'Producto';
    const cantidad = item.cantidad || 0;
    const baseLine = `${cantidad} ${nombre}`;

    if (tipo === 'COCINA') {
      const itemLines = wrapText(baseLine, maxChars);
      lineas.push(...itemLines);
    } else {
      const priceText = formatMoney(item.subtotal);
      const leftWidth = Math.max(10, maxChars - priceText.length - 1);
      const itemLines = wrapText(baseLine, leftWidth);
      if (itemLines.length > 0) {
        lineas.push(formatLineLeftRight(itemLines[0], priceText, maxChars));
        for (let i = 1; i < itemLines.length; i += 1) {
          lineas.push(itemLines[i]);
        }
      }
    }

    if (item.observaciones) {
      const obsLines = wrapText(`-> ${item.observaciones}`, maxChars);
      lineas.push(...obsLines);
    }
  }

  if (tipo === 'COCINA') {
    lineas.push(dashed);
  }

  if (tipo !== 'COCINA') {
    if (pedido.tipo === 'DELIVERY' || parseFloat(pedido.costoEnvio || 0) > 0) {
      lineas.push(formatLineLeftRight('COSTO DE ENVIO', formatMoney(pedido.costoEnvio), maxChars));
    }
    lineas.push(formatLineLeftRight('Subtotal', formatMoney(pedido.subtotal), maxChars));
    if (parseFloat(pedido.descuento) > 0) {
      lineas.push(formatLineLeftRight('Descuento', `-${formatMoney(pedido.descuento)}`, maxChars));
    }
    lineas.push('');
    lineas.push(formatLineLeftRight('Total', formatMoney(pedido.total), maxChars));
  }

  if (pedido.observaciones) {
    lineas.push('');
    lineas.push('OBSERVACIONES:');
    lineas.push(...wrapText(pedido.observaciones, maxChars));
  }

  if (tipo !== 'COCINA') {
    lineas.push('');
    lineas.push(...wrapText('DOCUMENTO NO VALIDO COMO FACTURA', maxChars));
    lineas.push(...wrapText('Comanda - Software gastronomico', maxChars));
  }

  lineas.push('');
  lineas.push('');
  lineas.push('');

  return lineas.join('\n');
};

const generateBatchId = () => {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString('hex');
};

const enqueuePrintJobs = async (prisma, pedidoId, options = {}) => {
  const anchoMm = parseInt(options.anchoMm || DEFAULT_WIDTH_MM, 10);
  const maxIntentos = parseInt(options.maxIntentos || DEFAULT_MAX_RETRIES, 10);
  const batchId = options.batchId || generateBatchId();

  const pedido = await prisma.pedido.findUnique({
    where: { id: parseInt(pedidoId) },
    include: {
      mesa: true,
      usuario: { select: { nombre: true } },
      items: { include: { producto: { select: { nombre: true } } } }
    }
  });

  if (!pedido) {
    throw createHttpError.notFound('Pedido no encontrado');
  }

  const comandas = {
    COCINA: buildComandaText(pedido, 'COCINA', anchoMm),
    CAJA: buildComandaText(pedido, 'CAJA', anchoMm),
    CLIENTE: buildComandaText(pedido, 'CLIENTE', anchoMm)
  };

  const now = new Date();
  const jobs = Object.entries(comandas).map(([tipo, contenido]) => ({
    pedidoId: pedido.id,
    tipo,
    status: 'PENDIENTE',
    intentos: 0,
    maxIntentos,
    nextAttemptAt: now,
    contenido,
    anchoMm,
    batchId,
    createdAt: now,
    updatedAt: now
  }));

  await prisma.$transaction([
    prisma.printJob.createMany({ data: jobs }),
    prisma.pedido.update({
      where: { id: pedido.id },
      data: { impreso: false }
    })
  ]);

  return { batchId, total: jobs.length, anchoMm };
};

const getLatestPrintSummary = (printJobs = []) => {
  if (!printJobs.length) return null;

  let latestJob = printJobs[0];
  for (const job of printJobs) {
    if (new Date(job.createdAt) > new Date(latestJob.createdAt)) {
      latestJob = job;
    }
  }

  const latestBatchId = latestJob.batchId;
  const batchJobs = printJobs.filter(job => job.batchId === latestBatchId);
  const total = batchJobs.length;
  const ok = batchJobs.filter(job => job.status === 'OK').length;
  const errorJobs = batchJobs.filter(job => job.status === 'ERROR');
  const error = errorJobs.length;
  const pending = batchJobs.filter(job => job.status === 'PENDIENTE' || job.status === 'IMPRIMIENDO').length;
  const lastError = errorJobs[0]?.lastError || null;

  let status = 'PENDIENTE';
  if (error > 0) status = 'ERROR';
  else if (ok === total && total > 0) status = 'OK';
  else if (pending > 0) status = 'PENDIENTE';

  return { batchId: latestBatchId, total, ok, error, pending, status, lastError };
};

const refreshPedidoImpresion = async (prisma, pedidoId, batchId) => {
  const jobs = await prisma.printJob.findMany({
    where: { pedidoId: parseInt(pedidoId), batchId }
  });

  if (!jobs.length) return null;

  const ok = jobs.filter(job => job.status === 'OK').length;
  const total = jobs.length;

  if (ok === total) {
    await prisma.pedido.update({
      where: { id: parseInt(pedidoId) },
      data: { impreso: true }
    });
  }

  return { total, ok };
};

/**
 * Genera texto de ticket fiscal (con datos AFIP, CAE, QR).
 *
 * @param {Object} comprobante - Comprobante con datos AFIP
 * @param {Object} negocio - Datos del negocio (razonSocial, cuit, etc.)
 * @param {Object} pedido - Pedido con items y mesa
 * @param {number} anchoMm - Ancho de papel (58 o 80)
 */
const buildFacturaText = (comprobante, negocio, pedido, anchoMm) => {
  const maxChars = getMaxChars(anchoMm);
  const dashed = '-'.repeat(maxChars);
  const lineas = [];

  // Tipo comprobante legible
  const TIPO_LABELS = {
    FACTURA_A: 'FACTURA A', FACTURA_B: 'FACTURA B', FACTURA_C: 'FACTURA C',
    NOTA_CREDITO_A: 'NOTA DE CREDITO A', NOTA_CREDITO_B: 'NOTA DE CREDITO B', NOTA_CREDITO_C: 'NOTA DE CREDITO C',
    NOTA_DEBITO_A: 'NOTA DE DEBITO A', NOTA_DEBITO_B: 'NOTA DE DEBITO B', NOTA_DEBITO_C: 'NOTA DE DEBITO C'
  };

  const CONDICION_LABELS = {
    RESPONSABLE_INSCRIPTO: 'IVA Responsable Inscripto',
    MONOTRIBUTISTA: 'Monotributista',
    EXENTO: 'IVA Exento'
  };

  // Header: datos del negocio
  if (negocio.razonSocial) {
    lineas.push(centerText(negocio.razonSocial, maxChars));
  } else if (negocio.nombre) {
    lineas.push(centerText(negocio.nombre, maxChars));
  }
  if (negocio.cuit) lineas.push(centerText(`CUIT: ${negocio.cuit}`, maxChars));
  if (negocio.condicionIva) lineas.push(centerText(CONDICION_LABELS[negocio.condicionIva] || negocio.condicionIva, maxChars));
  if (negocio.domicilioFiscal) {
    wrapText(negocio.domicilioFiscal, maxChars).forEach(l => lineas.push(centerText(l, maxChars)));
  }
  if (negocio.iibb) lineas.push(centerText(`IIBB: ${negocio.iibb}`, maxChars));

  lineas.push('');

  // Tipo y número de comprobante
  const tipoLabel = TIPO_LABELS[comprobante.tipoComprobante] || comprobante.tipoComprobante;
  const pv = String(comprobante.puntoVenta).padStart(4, '0');
  const nro = String(comprobante.nroComprobante).padStart(8, '0');
  lineas.push(centerText(`${tipoLabel}`, maxChars));
  lineas.push(centerText(`Nro: ${pv}-${nro}`, maxChars));

  // Fecha
  const fecha = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  }).format(new Date(comprobante.fechaComprobante));
  lineas.push(centerText(`Fecha: ${fecha}`, maxChars));

  lineas.push('');
  lineas.push(dashed);

  // Datos del receptor (si no es consumidor final)
  if (comprobante.docTipo !== 99) {
    const docLabels = { 80: 'CUIT', 86: 'CUIL', 96: 'DNI' };
    const docLabel = docLabels[comprobante.docTipo] || `Doc(${comprobante.docTipo})`;
    lineas.push(`${docLabel}: ${comprobante.docNro}`);
    if (comprobante.clienteNombre) lineas.push(`Cliente: ${comprobante.clienteNombre}`);
    lineas.push(dashed);
  }

  // Datos del pedido
  const pedidoInfo = [`Pedido: #${pedido.id}`];
  if (pedido.mesa) pedidoInfo.push(`Mesa: ${pedido.mesa.numero}`);
  lineas.push(pedidoInfo.join(' | '));
  lineas.push('');

  // Items
  for (const item of pedido.items) {
    const nombre = item.producto?.nombre || 'Producto';
    const cantidad = item.cantidad || 0;
    const baseLine = `${cantidad} ${nombre}`;
    const priceText = formatMoney(item.subtotal);
    const leftWidth = Math.max(10, maxChars - priceText.length - 1);
    const itemLines = wrapText(baseLine, leftWidth);
    if (itemLines.length > 0) {
      lineas.push(formatLineLeftRight(itemLines[0], priceText, maxChars));
      for (let i = 1; i < itemLines.length; i++) {
        lineas.push(itemLines[i]);
      }
    }

    if (item.observaciones) {
      wrapText(`-> ${item.observaciones}`, maxChars).forEach(l => lineas.push(l));
    }
  }

  lineas.push(dashed);

  // Totales fiscales
  const importeNeto = Number(comprobante.importeNeto || 0);
  const importeIva = Number(comprobante.importeIva || 0);
  const importeTotal = Number(comprobante.importeTotal || 0);

  if (importeIva > 0) {
    // Responsable Inscripto: discriminar IVA
    lineas.push(formatLineLeftRight('Neto Gravado', formatMoney(importeNeto), maxChars));
    lineas.push(formatLineLeftRight('IVA 21%', formatMoney(importeIva), maxChars));
  }
  lineas.push(formatLineLeftRight('TOTAL', formatMoney(importeTotal), maxChars));

  lineas.push('');

  // CAE y vencimiento
  if (comprobante.cae) {
    lineas.push(`CAE: ${comprobante.cae}`);
    if (comprobante.caeVencimiento) {
      const vtoFecha = new Intl.DateTimeFormat('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      }).format(new Date(comprobante.caeVencimiento));
      lineas.push(`Vto. CAE: ${vtoFecha}`);
    }
  }

  // QR URL
  if (comprobante.qrData) {
    lineas.push('');
    wrapText(comprobante.qrData, maxChars).forEach(l => lineas.push(l));
  }

  lineas.push('');
  lineas.push('');
  lineas.push('');

  return lineas.join('\n');
};

/**
 * Encola un print job con formato de factura fiscal.
 */
const enqueuePrintJobFactura = async (prisma, comprobanteId, options = {}) => {
  const anchoMm = parseInt(options.anchoMm || DEFAULT_WIDTH_MM, 10);
  const maxIntentos = parseInt(options.maxIntentos || DEFAULT_MAX_RETRIES, 10);
  const batchId = options.batchId || generateBatchId();

  const comprobante = await prisma.comprobante.findUnique({
    where: { id: parseInt(comprobanteId) },
    include: {
      pedido: {
        include: {
          mesa: true,
          items: { include: { producto: { select: { nombre: true } } } }
        }
      }
    }
  });

  if (!comprobante) {
    throw createHttpError.notFound('Comprobante no encontrado');
  }

  const negocio = await prisma.negocio.findUnique({ where: { id: 1 } });

  const contenido = buildFacturaText(comprobante, negocio, comprobante.pedido, anchoMm);

  const now = new Date();
  await prisma.printJob.create({
    data: {
      pedidoId: comprobante.pedidoId,
      tipo: 'CAJA',
      status: 'PENDIENTE',
      intentos: 0,
      maxIntentos,
      nextAttemptAt: now,
      contenido,
      anchoMm,
      batchId,
      createdAt: now,
      updatedAt: now
    }
  });

  return { batchId, total: 1, anchoMm };
};

module.exports = {
  buildComandaText,
  buildFacturaText,
  enqueuePrintJobs,
  enqueuePrintJobFactura,
  getLatestPrintSummary,
  refreshPedidoImpresion,
  getMaxChars
};
