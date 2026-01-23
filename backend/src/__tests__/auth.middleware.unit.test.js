const jwt = require('jsonwebtoken');

const mockPrisma = {
  usuario: {
    findUnique: jest.fn()
  },
  tenant: {
    findUnique: jest.fn()
  }
};

jest.mock('../db/prisma', () => ({
  prisma: mockPrisma
}));

const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('auth.middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  it('responde 401 si falta el token', async () => {
    const req = { headers: {} };
    const res = createRes();
    const next = jest.fn();

    await verificarToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'Token no proporcionado' } });
    expect(next).not.toHaveBeenCalled();
  });

  it('responde 401 si el usuario no existe', async () => {
    const token = jwt.sign({ id: 123 }, process.env.JWT_SECRET);
    mockPrisma.usuario.findUnique.mockResolvedValue(null);

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = createRes();
    const next = jest.fn();

    await verificarToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'Usuario no válido o inactivo' } });
    expect(next).not.toHaveBeenCalled();
  });

  it('responde 403 si el tenant esta inactivo', async () => {
    const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET);
    mockPrisma.usuario.findUnique.mockResolvedValue({
      id: 1,
      activo: true,
      rol: 'ADMIN',
      tenantId: 99
    });
    mockPrisma.tenant.findUnique.mockResolvedValue({ id: 99, activo: false });

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = createRes();
    const next = jest.fn();

    await verificarToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'El restaurante asociado no está activo' }
    });
  });

  it('setea req.usuario y llama next cuando el token es valido', async () => {
    const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET);
    mockPrisma.usuario.findUnique.mockResolvedValue({
      id: 1,
      activo: true,
      rol: 'ADMIN',
      tenantId: 10
    });
    mockPrisma.tenant.findUnique.mockResolvedValue({ id: 10, activo: true });

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = createRes();
    const next = jest.fn();

    await verificarToken(req, res, next);

    expect(req.usuario).toEqual(expect.objectContaining({ id: 1, rol: 'ADMIN' }));
    expect(next).toHaveBeenCalled();
  });

  it('responde 401 cuando el token expiro', async () => {
    const expiredToken = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: '-1s' });
    const req = { headers: { authorization: `Bearer ${expiredToken}` } };
    const res = createRes();
    const next = jest.fn();

    await verificarToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'Token expirado' } });
  });

  it('responde 401 cuando el token es invalido', async () => {
    const req = { headers: { authorization: 'Bearer token-invalido' } };
    const res = createRes();
    const next = jest.fn();

    await verificarToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'Token inválido' } });
  });
});

describe('verificarRol', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rechaza cuando no hay usuario', () => {
    const middleware = verificarRol('ADMIN');
    const req = {};
    const res = createRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'No autenticado' } });
    expect(next).not.toHaveBeenCalled();
  });

  it('rechaza cuando no tiene rol permitido', () => {
    const middleware = verificarRol('ADMIN');
    const req = { usuario: { rol: 'MOZO' } };
    const res = createRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'No tienes permisos para realizar esta acción' }
    });
  });

  it('permite cuando tiene rol permitido', () => {
    const middleware = verificarRol('ADMIN');
    const req = { usuario: { rol: 'ADMIN' } };
    const res = createRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
