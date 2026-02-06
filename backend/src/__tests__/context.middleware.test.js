jest.mock('../db/prisma', () => ({
  prisma: {
    suscripcion: {
      findUnique: jest.fn()
    }
  }
}));

jest.mock('../utils/cache', () => ({
  subscriptionCache: {
    get: jest.fn(),
    set: jest.fn()
  }
}));

const { prisma } = require('../db/prisma');
const { subscriptionCache } = require('../utils/cache');
const {
  setAuthContext,
  setPublicContext,
  bloquearSiSoloLectura
} = require('../middlewares/context.middleware');

describe('context.middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setAuthContext', () => {
    it('sets req.prisma to the singleton prisma client', async () => {
      subscriptionCache.get.mockReturnValue({
        id: 1,
        estado: 'ACTIVA',
        fechaVencimiento: new Date(Date.now() + 86400000)
      });

      const req = { usuario: { id: 1 } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await setAuthContext(req, res, next);

      expect(req.prisma).toBe(prisma);
      expect(next).toHaveBeenCalled();
    });

    it('sets modoSoloLectura = false when subscription is active', async () => {
      subscriptionCache.get.mockReturnValue({
        id: 1,
        estado: 'ACTIVA',
        fechaVencimiento: new Date(Date.now() + 86400000)
      });

      const req = { usuario: { id: 1 } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await setAuthContext(req, res, next);

      expect(req.modoSoloLectura).toBe(false);
    });

    it('sets modoSoloLectura = true when no subscription found', async () => {
      subscriptionCache.get.mockReturnValue(null);
      prisma.suscripcion.findUnique.mockResolvedValue(null);

      const req = { usuario: { id: 1 } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await setAuthContext(req, res, next);

      expect(req.modoSoloLectura).toBe(true);
    });

    it('sets modoSoloLectura = true when subscription is expired', async () => {
      subscriptionCache.get.mockReturnValue({
        id: 1,
        estado: 'ACTIVA',
        fechaVencimiento: new Date(Date.now() - 86400000)
      });

      const req = { usuario: { id: 1 } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await setAuthContext(req, res, next);

      expect(req.modoSoloLectura).toBe(true);
    });
  });

  describe('setPublicContext', () => {
    it('sets req.prisma and calls next', () => {
      const req = {};
      const res = {};
      const next = jest.fn();

      setPublicContext(req, res, next);

      expect(req.prisma).toBe(prisma);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('bloquearSiSoloLectura', () => {
    it('blocks write operations when modoSoloLectura is true', () => {
      const req = { modoSoloLectura: true };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      bloquearSiSoloLectura(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'SUBSCRIPTION_REQUIRED',
          message: 'Tu suscripci\u00f3n no est\u00e1 activa. Solo puedes ver informaci\u00f3n pero no realizar cambios.',
          action: 'subscribe'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('allows write operations when modoSoloLectura is false', () => {
      const req = { modoSoloLectura: false };
      const res = {};
      const next = jest.fn();

      bloquearSiSoloLectura(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
