const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

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
    lineas.push(...wrapText('GestioNeo - Software gastronomico', maxChars));
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

const enqueuePrintJobs = async (pedidoId, options = {}) => {
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
    throw new Error('Pedido no encontrado');
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

const refreshPedidoImpresion = async (pedidoId, batchId) => {
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

module.exports = {
  buildComandaText,
  enqueuePrintJobs,
  getLatestPrintSummary,
  refreshPedidoImpresion,
  getMaxChars
};
