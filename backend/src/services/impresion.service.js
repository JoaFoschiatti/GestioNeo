const { createHttpError } = require('../utils/http-error');
const printService = require('./print.service');

const parseLimit = (value, defaultValue = 3) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, 1), 10);
};

const parseWidth = (value, defaultValue = 80) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return defaultValue;
  if (parsed === 58) return 58;
  return 80;
};

const getBackoffMs = () => {
  const parsed = parseInt(process.env.PRINT_BACKOFF_MS || '2000', 10);
  return Number.isNaN(parsed) ? 2000 : parsed;
};

const imprimirComanda = async (prisma, pedidoId, options = {}) => {
  const anchoMm = options.anchoMm === undefined ? undefined : parseWidth(options.anchoMm);
  return printService.enqueuePrintJobs(prisma, pedidoId, { anchoMm });
};

const previewComanda = async (prisma, pedidoId, query = {}) => {
  const tipo = (query.tipo || 'CLIENTE').toUpperCase();
  const anchoMm = query.anchoMm === undefined ? undefined : parseWidth(query.anchoMm);

  const pedido = await prisma.pedido.findUnique({
    where: { id: parseInt(pedidoId, 10) },
    include: {
      mesa: true,
      usuario: { select: { nombre: true } },
      items: { include: { producto: { select: { nombre: true } } } }
    }
  });

  if (!pedido) {
    throw createHttpError.notFound('Pedido no encontrado');
  }

  return printService.buildComandaText(pedido, tipo, anchoMm);
};

const estadoImpresora = async (prisma) => {
  const pendientes = await prisma.printJob.count({
    where: { status: { in: ['PENDIENTE', 'IMPRIMIENDO'] } }
  });

  const errores = await prisma.printJob.findMany({
    where: { status: 'ERROR' },
    orderBy: { updatedAt: 'desc' },
    take: 5
  });

  return {
    pendienteCount: pendientes,
    errorCount: errores.length,
    ultimosErrores: errores.map(err => ({
      id: err.id,
      pedidoId: err.pedidoId,
      tipo: err.tipo,
      lastError: err.lastError,
      updatedAt: err.updatedAt
    })),
    bridgeConfigured: Boolean(process.env.BRIDGE_TOKEN)
  };
};

const claimJobs = async (prisma, payload = {}) => {
  const bridgeId = payload.bridgeId || 'bridge';
  const limit = parseLimit(payload.limit);
  const now = new Date();
  const claimTtlMs = parseInt(process.env.PRINT_CLAIM_TTL_MS || '60000', 10);
  const staleBefore = new Date(now.getTime() - (Number.isNaN(claimTtlMs) ? 60000 : claimTtlMs));

  await prisma.printJob.updateMany({
    where: {
      status: 'IMPRIMIENDO',
      claimedAt: { lt: staleBefore }
    },
    data: {
      status: 'PENDIENTE',
      claimedBy: null,
      claimedAt: null,
      lastError: 'Reclaim after timeout'
    }
  });

  const candidates = await prisma.printJob.findMany({
    where: {
      status: 'PENDIENTE',
      nextAttemptAt: { lte: now }
    },
    orderBy: { createdAt: 'asc' },
    take: limit * 2
  });

  const claimedIds = [];

  for (const job of candidates) {
    if (claimedIds.length >= limit) break;

    if (job.intentos >= job.maxIntentos) {
      await prisma.printJob.update({
        where: { id: job.id },
        data: {
          status: 'ERROR',
          lastError: job.lastError || 'Max reintentos alcanzado'
        }
      });
      continue;
    }

    const updated = await prisma.printJob.updateMany({
      where: { id: job.id, status: 'PENDIENTE' },
      data: {
        status: 'IMPRIMIENDO',
        claimedBy: bridgeId,
        claimedAt: now,
        intentos: { increment: 1 }
      }
    });

    if (updated.count === 1) {
      claimedIds.push(job.id);
    }
  }

  const jobs = claimedIds.length
    ? await prisma.printJob.findMany({
      where: { id: { in: claimedIds } },
      orderBy: { createdAt: 'asc' }
    })
    : [];

  return { jobs };
};

const ackJob = async (prisma, jobId, payload = {}) => {
  const bridgeId = payload.bridgeId;

  const job = await prisma.printJob.findUnique({
    where: { id: parseInt(jobId, 10) }
  });

  if (!job) {
    throw createHttpError.notFound('Job no encontrado');
  }

  if (job.status === 'OK') {
    return { alreadyOk: true };
  }

  if (job.status !== 'IMPRIMIENDO') {
    throw createHttpError.conflict('Job no esta en impresion');
  }

  if (bridgeId && job.claimedBy && job.claimedBy !== bridgeId) {
    throw createHttpError.conflict('Job reclamado por otro bridge');
  }

  await prisma.printJob.update({
    where: { id: job.id },
    data: {
      status: 'OK',
      lastError: null,
      claimedBy: null,
      claimedAt: null
    }
  });

  const resumen = await printService.refreshPedidoImpresion(prisma, job.pedidoId, job.batchId);
  return { resumen, pedidoId: job.pedidoId };
};

const failJob = async (prisma, jobId, payload = {}) => {
  const bridgeId = payload.bridgeId;
  const errorMessage = payload.error || 'Error de impresion';

  const job = await prisma.printJob.findUnique({
    where: { id: parseInt(jobId, 10) }
  });

  if (!job) {
    throw createHttpError.notFound('Job no encontrado');
  }

  if (bridgeId && job.claimedBy && job.claimedBy !== bridgeId) {
    throw createHttpError.conflict('Job reclamado por otro bridge');
  }

  const now = new Date();
  const backoff = getBackoffMs();
  const nextDelay = backoff * Math.pow(2, Math.max(0, job.intentos - 1));

  if (job.intentos >= job.maxIntentos) {
    await prisma.printJob.update({
      where: { id: job.id },
      data: {
        status: 'ERROR',
        lastError: errorMessage,
        claimedBy: null,
        claimedAt: null
      }
    });
  } else {
    await prisma.printJob.update({
      where: { id: job.id },
      data: {
        status: 'PENDIENTE',
        lastError: errorMessage,
        nextAttemptAt: new Date(now.getTime() + nextDelay),
        claimedBy: null,
        claimedAt: null
      }
    });
  }

  const resumen = await printService.refreshPedidoImpresion(prisma, job.pedidoId, job.batchId);
  return { resumen, pedidoId: job.pedidoId };
};

module.exports = {
  imprimirComanda,
  previewComanda,
  estadoImpresora,
  claimJobs,
  ackJob,
  failJob
};
