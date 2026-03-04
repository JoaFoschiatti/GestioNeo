const printService = require('../services/print.service');
const {
  imprimirComanda,
  previewComanda,
  claimJobs,
  ackJob,
  failJob
} = require('../services/impresion.service');

jest.mock('../services/print.service', () => ({
  enqueuePrintJobs: jest.fn(),
  buildComandaText: jest.fn(),
  refreshPedidoImpresion: jest.fn()
}));

const applyUpdate = (job, data) => {
  Object.entries(data).forEach(([key, value]) => {
    if (value && typeof value === 'object' && 'increment' in value) {
      job[key] = (job[key] || 0) + value.increment;
      return;
    }
    job[key] = value;
  });
};

const createPrisma = (jobs = []) => {
  const state = jobs.map(job => ({ ...job }));

  const printJob = {
    updateMany: jest.fn(async ({ where, data }) => {
      let count = 0;
      state.forEach((job) => {
        if (where?.id !== undefined && job.id !== where.id) return;
        if (where?.status && job.status !== where.status) return;

        if (where?.claimedAt?.lt && !(job.claimedAt instanceof Date)) return;
        if (where?.claimedAt?.lt && !(job.claimedAt < where.claimedAt.lt)) return;

        applyUpdate(job, data);
        count += 1;
      });
      return { count };
    }),
    findMany: jest.fn(async (args = {}) => {
      let result = [...state];

      if (args.where?.id?.in) {
        const ids = new Set(args.where.id.in);
        result = result.filter(job => ids.has(job.id));
      }

      if (args.where?.status) {
        if (typeof args.where.status === 'string') {
          result = result.filter(job => job.status === args.where.status);
        } else if (Array.isArray(args.where.status?.in)) {
          const allowed = new Set(args.where.status.in);
          result = result.filter(job => allowed.has(job.status));
        }
      }

      if (args.where?.nextAttemptAt?.lte) {
        const cutoff = args.where.nextAttemptAt.lte;
        result = result.filter(job => job.nextAttemptAt && job.nextAttemptAt <= cutoff);
      }

      if (args.orderBy?.createdAt === 'asc') {
        result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      }

      if (args.take) {
        result = result.slice(0, args.take);
      }

      return result.map(job => ({ ...job }));
    }),
    update: jest.fn(async ({ where, data }) => {
      const job = state.find(item => item.id === where.id);
      if (!job) return null;
      applyUpdate(job, data);
      return { ...job };
    }),
    findUnique: jest.fn(async ({ where }) => {
      const job = state.find(item => item.id === where.id);
      return job ? { ...job } : null;
    })
  };

  const pedido = {
    findUnique: jest.fn()
  };

  return { prisma: { printJob, pedido }, state };
};

describe('impresion.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('imprimirComanda', () => {
    it('normaliza el ancho cuando no es 58', async () => {
      const prisma = {};
      printService.enqueuePrintJobs.mockResolvedValue({ batchId: 'b1' });

      await imprimirComanda(prisma, 10, { anchoMm: 60 });

      expect(printService.enqueuePrintJobs).toHaveBeenCalledWith(prisma, 10, { anchoMm: 80 });
    });

    it('respeta el ancho 58', async () => {
      const prisma = {};
      printService.enqueuePrintJobs.mockResolvedValue({ batchId: 'b2' });

      await imprimirComanda(prisma, 10, { anchoMm: 58 });

      expect(printService.enqueuePrintJobs).toHaveBeenCalledWith(prisma, 10, { anchoMm: 58 });
    });
  });

  describe('previewComanda', () => {
    it('lanza error si el pedido no existe', async () => {
      const { prisma } = createPrisma();
      prisma.pedido.findUnique.mockResolvedValue(null);

      await expect(previewComanda(prisma, 999, {})).rejects.toMatchObject({ status: 404 });
    });

    it('genera texto con tipo normalizado', async () => {
      const { prisma } = createPrisma();
      const pedido = { id: 1, createdAt: new Date(), items: [] };
      prisma.pedido.findUnique.mockResolvedValue(pedido);
      printService.buildComandaText.mockReturnValue('texto');

      const result = await previewComanda(prisma, 1, { tipo: 'caja', anchoMm: 58 });

      expect(printService.buildComandaText).toHaveBeenCalledWith(pedido, 'CAJA', 58);
      expect(result).toBe('texto');
    });
  });

  describe('claimJobs', () => {
    const originalTtl = process.env.PRINT_CLAIM_TTL_MS;

    beforeEach(() => {
      process.env.PRINT_CLAIM_TTL_MS = '60000';
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    });

    afterEach(() => {
      process.env.PRINT_CLAIM_TTL_MS = originalTtl;
      jest.useRealTimers();
    });

    it('reclama jobs pendientes y marca max reintentos como error', async () => {
      const now = new Date();
      const { prisma, state } = createPrisma([
        {
          id: 1,
          status: 'IMPRIMIENDO',
          claimedAt: new Date(now.getTime() - 120000),
          intentos: 1,
          maxIntentos: 3,
          nextAttemptAt: new Date(now.getTime() - 1000),
          createdAt: new Date(now.getTime() - 5000)
        },
        {
          id: 2,
          status: 'PENDIENTE',
          intentos: 0,
          maxIntentos: 3,
          nextAttemptAt: new Date(now.getTime() - 1000),
          createdAt: new Date(now.getTime() - 4000)
        },
        {
          id: 3,
          status: 'PENDIENTE',
          intentos: 3,
          maxIntentos: 3,
          nextAttemptAt: new Date(now.getTime() - 1000),
          createdAt: new Date(now.getTime() - 3000)
        }
      ]);

      const result = await claimJobs(prisma, { bridgeId: 'bridge', limit: 3 });

      expect(result.jobs.length).toBeGreaterThan(0);

      const maxed = state.find(job => job.id === 3);
      expect(maxed.status).toBe('ERROR');
      expect(maxed.lastError).toBe('Max reintentos alcanzado');

      const reclaimed = state.find(job => job.id === 1);
      expect(reclaimed.lastError).toBe('Reclaim after timeout');
    });
  });

  describe('ackJob', () => {
    it('devuelve alreadyOk cuando el job ya esta OK', async () => {
      const { prisma } = createPrisma([
        { id: 1, status: 'OK' }
      ]);

      const result = await ackJob(prisma, 1, { bridgeId: 'bridge' });

      expect(result).toEqual({ alreadyOk: true });
    });

    it('falla si el job no esta en impresion', async () => {
      const { prisma } = createPrisma([
        { id: 1, status: 'PENDIENTE' }
      ]);

      await expect(ackJob(prisma, 1, { bridgeId: 'bridge' })).rejects.toMatchObject({ status: 409 });
    });

    it('falla si el job pertenece a otro bridge', async () => {
      const { prisma } = createPrisma([
        { id: 1, status: 'IMPRIMIENDO', claimedBy: 'otro' }
      ]);

      await expect(ackJob(prisma, 1, { bridgeId: 'bridge' })).rejects.toMatchObject({ status: 409 });
    });

    it('marca el job como OK y actualiza resumen', async () => {
      const { prisma, state } = createPrisma([
        { id: 1, status: 'IMPRIMIENDO', claimedBy: 'bridge', pedidoId: 10, batchId: 'b1' }
      ]);
      printService.refreshPedidoImpresion.mockResolvedValue({ total: 1, ok: 1 });

      const result = await ackJob(prisma, 1, { bridgeId: 'bridge' });

      expect(result).toEqual({ resumen: { total: 1, ok: 1 }, pedidoId: 10 });
      expect(state[0].status).toBe('OK');
      expect(state[0].claimedBy).toBeNull();
    });
  });

  describe('failJob', () => {
    const originalBackoff = process.env.PRINT_BACKOFF_MS;

    beforeEach(() => {
      process.env.PRINT_BACKOFF_MS = '1000';
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    });

    afterEach(() => {
      process.env.PRINT_BACKOFF_MS = originalBackoff;
      jest.useRealTimers();
    });

    it('programa reintento cuando quedan intentos', async () => {
      const now = new Date();
      const { prisma, state } = createPrisma([
        { id: 1, status: 'IMPRIMIENDO', intentos: 1, maxIntentos: 3, claimedBy: 'bridge', pedidoId: 10, batchId: 'b1' }
      ]);
      printService.refreshPedidoImpresion.mockResolvedValue({ total: 1, ok: 0 });

      await failJob(prisma, 1, { bridgeId: 'bridge', error: 'Paper' });

      expect(state[0].status).toBe('PENDIENTE');
      expect(state[0].lastError).toBe('Paper');
      expect(state[0].nextAttemptAt.getTime()).toBe(now.getTime() + 1000);
    });

    it('marca error cuando excede max intentos', async () => {
      const { prisma, state } = createPrisma([
        { id: 1, status: 'IMPRIMIENDO', intentos: 3, maxIntentos: 3, claimedBy: 'bridge', pedidoId: 10, batchId: 'b1' }
      ]);
      printService.refreshPedidoImpresion.mockResolvedValue({ total: 1, ok: 0 });

      await failJob(prisma, 1, { bridgeId: 'bridge', error: 'Paper' });

      expect(state[0].status).toBe('ERROR');
      expect(state[0].lastError).toBe('Paper');
    });

    it('falla si el job pertenece a otro bridge', async () => {
      const { prisma } = createPrisma([
        { id: 1, status: 'IMPRIMIENDO', claimedBy: 'otro' }
      ]);

      await expect(failJob(prisma, 1, { bridgeId: 'bridge' })).rejects.toMatchObject({ status: 409 });
    });
  });
});
