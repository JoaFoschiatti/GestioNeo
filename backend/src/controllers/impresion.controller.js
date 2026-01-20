const { PrismaClient } = require('@prisma/client');
const eventBus = require('../services/event-bus');
const printService = require('../services/print.service');

const prisma = new PrismaClient();

const parseLimit = (value) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return 3;
  return Math.min(Math.max(parsed, 1), 10);
};

const getBackoffMs = () => {
  const parsed = parseInt(process.env.PRINT_BACKOFF_MS || '2000', 10);
  return Number.isNaN(parsed) ? 2000 : parsed;
};

// Encolar comandas (manual o reimpresion)
const imprimirComanda = async (req, res) => {
  try {
    const { pedidoId } = req.params;
    const anchoMm = req.body?.anchoMm;

    const result = await printService.enqueuePrintJobs(pedidoId, { anchoMm });

    eventBus.publish('impresion.updated', {
      pedidoId: parseInt(pedidoId),
      ok: 0,
      total: result.total
    });

    res.json({
      success: true,
      message: 'Jobs de impresion creados',
      ...result
    });
  } catch (error) {
    console.error('Error al crear jobs de impresion:', error);
    res.status(500).json({ error: { message: 'Error al crear jobs de impresion' } });
  }
};

// Preview de comanda (sin encolar)
const previewComanda = async (req, res) => {
  try {
    const { pedidoId } = req.params;
    const tipo = (req.query.tipo || 'CLIENTE').toUpperCase();
    const anchoMm = req.query.anchoMm;

    const pedido = await prisma.pedido.findUnique({
      where: { id: parseInt(pedidoId) },
      include: {
        mesa: true,
        usuario: { select: { nombre: true } },
        items: { include: { producto: { select: { nombre: true } } } }
      }
    });

    if (!pedido) {
      return res.status(404).json({ error: { message: 'Pedido no encontrado' } });
    }

    const contenido = printService.buildComandaText(pedido, tipo, anchoMm);
    res.type('text/plain').send(contenido);
  } catch (error) {
    console.error('Error al generar preview:', error);
    res.status(500).json({ error: { message: 'Error al generar preview' } });
  }
};

// Estado general de impresion
const estadoImpresora = async (req, res) => {
  try {
    const pendientes = await prisma.printJob.count({
      where: { status: { in: ['PENDIENTE', 'IMPRIMIENDO'] } }
    });

    const errores = await prisma.printJob.findMany({
      where: { status: 'ERROR' },
      orderBy: { updatedAt: 'desc' },
      take: 5
    });

    res.json({
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
    });
  } catch (error) {
    console.error('Error al obtener estado de impresion:', error);
    res.status(500).json({ error: { message: 'Error al obtener estado de impresion' } });
  }
};

// Reimprimir comanda (nuevo batch)
const reimprimirComanda = async (req, res) => {
  return imprimirComanda(req, res);
};

// Bridge: reclamar jobs pendientes
const claimJobs = async (req, res) => {
  try {
    const bridgeId = req.body?.bridgeId || 'bridge';
    const limit = parseLimit(req.body?.limit);
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

    res.json({ jobs });
  } catch (error) {
    console.error('Error al reclamar jobs:', error);
    res.status(500).json({ error: { message: 'Error al reclamar jobs' } });
  }
};

// Bridge: confirmar impresion
const ackJob = async (req, res) => {
  try {
    const { id } = req.params;
    const bridgeId = req.body?.bridgeId;

    const job = await prisma.printJob.findUnique({
      where: { id: parseInt(id) }
    });

    if (!job) {
      return res.status(404).json({ error: { message: 'Job no encontrado' } });
    }

    if (job.status === 'OK') {
      return res.json({ success: true, status: 'OK' });
    }

    if (job.status !== 'IMPRIMIENDO') {
      return res.status(409).json({ error: { message: 'Job no esta en impresion' } });
    }

    if (bridgeId && job.claimedBy && job.claimedBy !== bridgeId) {
      return res.status(409).json({ error: { message: 'Job reclamado por otro bridge' } });
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

    const resumen = await printService.refreshPedidoImpresion(job.pedidoId, job.batchId);
    if (resumen) {
      eventBus.publish('impresion.updated', {
        pedidoId: job.pedidoId,
        ok: resumen.ok,
        total: resumen.total
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error al confirmar job:', error);
    res.status(500).json({ error: { message: 'Error al confirmar job' } });
  }
};

// Bridge: informar fallo de impresion
const failJob = async (req, res) => {
  try {
    const { id } = req.params;
    const bridgeId = req.body?.bridgeId;
    const errorMessage = req.body?.error || 'Error de impresion';

    const job = await prisma.printJob.findUnique({
      where: { id: parseInt(id) }
    });

    if (!job) {
      return res.status(404).json({ error: { message: 'Job no encontrado' } });
    }

    if (bridgeId && job.claimedBy && job.claimedBy !== bridgeId) {
      return res.status(409).json({ error: { message: 'Job reclamado por otro bridge' } });
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

    const resumen = await printService.refreshPedidoImpresion(job.pedidoId, job.batchId);
    if (resumen) {
      eventBus.publish('impresion.updated', {
        pedidoId: job.pedidoId,
        ok: resumen.ok,
        total: resumen.total
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error al registrar fallo de impresion:', error);
    res.status(500).json({ error: { message: 'Error al registrar fallo de impresion' } });
  }
};

module.exports = {
  imprimirComanda,
  previewComanda,
  estadoImpresora,
  reimprimirComanda,
  claimJobs,
  ackJob,
  failJob
};
