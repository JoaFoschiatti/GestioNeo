jest.mock('../db/prisma', () => ({
  prisma: {
    tenant: {
      findUnique: jest.fn()
    }
  },
  getTenantPrisma: jest.fn(() => ({ scoped: true })),
  getTenantBySlug: jest.fn()
}));

const { prisma, getTenantBySlug, getTenantPrisma } = require('../db/prisma');
const {
  resolveTenantFromSlug,
  setTenantFromAuth,
  setTenantFromSlugHeader
} = require('../middlewares/tenant.middleware');

describe('tenant.middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolveTenantFromSlug exige slug', async () => {
    const req = { params: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await resolveTenantFromSlug(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Slug de restaurante requerido' }
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('resolveTenantFromSlug adjunta contexto de tenant', async () => {
    getTenantBySlug.mockResolvedValueOnce({ id: 7, slug: 'demo', activo: true });

    const req = { params: { slug: 'demo' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await resolveTenantFromSlug(req, res, next);

    expect(req.tenantId).toBe(7);
    expect(req.tenantSlug).toBe('demo');
    expect(req.prisma).toEqual({ scoped: true });
    expect(next).toHaveBeenCalled();
  });

  it('setTenantFromSlugHeader devuelve error si falta slug', async () => {
    const req = { headers: {} };
    const next = jest.fn();

    await setTenantFromSlugHeader(req, {}, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 400,
      message: 'Slug de restaurante requerido'
    }));
  });

  it('setTenantFromAuth rechaza usuarios sin tenantId', async () => {
    const req = { usuario: { rol: 'ADMIN' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await setTenantFromAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('setTenantFromAuth permite super admin', async () => {
    const req = { usuario: { rol: 'SUPER_ADMIN' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await setTenantFromAuth(req, res, next);

    expect(req.isSuperAdmin).toBe(true);
    expect(req.prisma).toBe(prisma);
    expect(next).toHaveBeenCalled();
  });

  it('setTenantFromAuth adjunta tenant activo', async () => {
    prisma.tenant.findUnique.mockResolvedValueOnce({ id: 5, slug: 'demo', activo: true });

    const req = { usuario: { rol: 'ADMIN', tenantId: 5 } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await setTenantFromAuth(req, res, next);

    expect(getTenantPrisma).toHaveBeenCalledWith(5);
    expect(req.tenantId).toBe(5);
    expect(req.tenantSlug).toBe('demo');
    expect(req.prisma).toEqual({ scoped: true });
    expect(next).toHaveBeenCalled();
  });
});
