const jwt = require('jsonwebtoken');
const { prisma } = require('../db/prisma');

const userCache = new Map();
const CACHE_TTL = 60 * 1000;
const CACHE_MAX_SIZE = 500;

const verificarToken = async (req, res, next) => {
  try {
    let token = req.cookies?.token;

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      return res.status(401).json({ error: { message: 'Token no proporcionado' } });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const cacheKey = decoded.id;
    const cached = userCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      req.usuario = cached.user;
      return next();
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        nombre: true,
        rol: true,
        activo: true
      }
    });

    if (!usuario || !usuario.activo) {
      userCache.delete(cacheKey);
      return res.status(401).json({ error: { message: 'Usuario no valido o inactivo' } });
    }

    if (userCache.size >= CACHE_MAX_SIZE) {
      const oldestKey = userCache.keys().next().value;
      userCache.delete(oldestKey);
    }
    userCache.set(cacheKey, { user: usuario, ts: Date.now() });
    req.usuario = usuario;
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: { message: 'Token expirado' } });
    }

    return res.status(401).json({ error: { message: 'Token invalido' } });
  }
};

const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: { message: 'No autenticado' } });
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({
        error: { message: 'No tienes permisos para realizar esta accion' }
      });
    }

    return next();
  };
};

const esAdmin = verificarRol('ADMIN');
const esAdminOCajero = verificarRol('ADMIN', 'CAJERO');
const esMozo = verificarRol('ADMIN', 'MOZO');
const esDelivery = verificarRol('ADMIN', 'DELIVERY');
const esCocinero = verificarRol('ADMIN', 'COCINERO');

module.exports = {
  verificarToken,
  verificarRol,
  esAdmin,
  esAdminOCajero,
  esMozo,
  esDelivery,
  esCocinero
};
