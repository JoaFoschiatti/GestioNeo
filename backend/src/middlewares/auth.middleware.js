const jwt = require('jsonwebtoken');
const { prisma } = require('../db/prisma');

/**
 * Middleware para verificar token JWT
 * Incluye tenantId en el usuario para multi-tenancy
 */
const verificarToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: { message: 'Token no proporcionado' } });
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const usuario = await prisma.usuario.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        nombre: true,
        rol: true,
        activo: true,
        tenantId: true
      }
    });

    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: { message: 'Usuario no válido o inactivo' } });
    }

    // For non-SUPER_ADMIN users, verify tenant is active
    if (usuario.rol !== 'SUPER_ADMIN' && usuario.tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: usuario.tenantId }
      });

      if (!tenant || !tenant.activo) {
        return res.status(403).json({
          error: { message: 'El restaurante asociado no está activo' }
        });
      }
    }

    req.usuario = usuario;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: { message: 'Token expirado' } });
    }
    return res.status(401).json({ error: { message: 'Token inválido' } });
  }
};

/**
 * Middleware para verificar roles
 * SUPER_ADMIN tiene acceso a todo
 */
const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: { message: 'No autenticado' } });
    }

    // SUPER_ADMIN siempre tiene acceso
    if (req.usuario.rol === 'SUPER_ADMIN') {
      return next();
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({
        error: { message: 'No tienes permisos para realizar esta acción' }
      });
    }

    next();
  };
};

// Middleware para verificar si es admin
const esAdmin = verificarRol('ADMIN');

// Middleware para verificar si es admin o cajero
const esAdminOCajero = verificarRol('ADMIN', 'CAJERO');

// Middleware para verificar si es mozo
const esMozo = verificarRol('ADMIN', 'MOZO');

// Middleware para verificar si es delivery
const esDelivery = verificarRol('ADMIN', 'DELIVERY');

// Middleware para verificar si es cocinero
const esCocinero = verificarRol('ADMIN', 'COCINERO');

// Middleware para verificar si es super admin
const esSuperAdmin = verificarRol('SUPER_ADMIN');

module.exports = {
  verificarToken,
  verificarRol,
  esAdmin,
  esAdminOCajero,
  esMozo,
  esDelivery,
  esCocinero,
  esSuperAdmin
};
