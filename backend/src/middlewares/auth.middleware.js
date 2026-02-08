/**
 * Middleware de autenticación y autorización.
 *
 * Este archivo contiene los middlewares que protegen las rutas de la API:
 * - verificarToken: Valida JWT y carga usuario en req.usuario
 * - verificarRol: Verifica que el usuario tenga un rol permitido
 * - Shortcuts: esAdmin, esMozo, esCocinero, etc.
 *
 * Uso en rutas:
 * ```javascript
 * // Ruta protegida solo para admin
 * router.get('/reportes', verificarToken, verificarRol('ADMIN'), controller.get);
 *
 * // Ruta protegida para múltiples roles
 * router.post('/pedidos', verificarToken, verificarRol('ADMIN', 'MOZO'), controller.create);
 *
 * // Usando shortcuts
 * router.get('/mesas', verificarToken, esMozo, controller.listar);
 * ```
 *
 * @module auth.middleware
 */

const jwt = require('jsonwebtoken');
const { prisma } = require('../db/prisma');
const { userCache } = require('../utils/cache');
const { CAPABILITY, rolesForCapability, hasRoleForCapability } = require('../auth/permissions');

/**
 * Verifica el token JWT y agrega el usuario al request.
 *
 * Flujo de verificación:
 * 1. Extrae token del header `Authorization: Bearer <token>` o cookie
 * 2. Verifica la firma con JWT_SECRET
 * 3. Busca el usuario en la base de datos
 * 4. Verifica que el usuario esté activo
 * 5. Agrega `req.usuario` con los datos del usuario
 *
 * @param {import('express').Request} req - Request de Express
 * @param {import('express').Response} res - Response de Express
 * @param {import('express').NextFunction} next - Siguiente middleware
 *
 * @returns {void} Llama a next() si el token es válido
 *
 * @example
 * // El token debe enviarse así:
 * // Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *
 * // Después del middleware, req.usuario contiene:
 * // {
 * //   id: 1,
 * //   email: 'admin@restaurante.com',
 * //   nombre: 'Juan Admin',
 * //   rol: 'ADMIN',
 * //   activo: true
 * // }
 */
const verificarToken = async (req, res, next) => {
  try {
    // Try to get token from httpOnly cookie first (secure method)
    let token = req.cookies?.token;

    // Fallback to Authorization header for backwards compatibility
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      return res.status(401).json({ error: { message: 'Token no proporcionado' } });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let usuario = userCache.get(decoded.id);
    if (!usuario) {
      usuario = await prisma.usuario.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          nombre: true,
          rol: true,
          activo: true
        }
      });
      if (usuario) {
        userCache.set(decoded.id, usuario);
      }
    }

    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: { message: 'Usuario no válido o inactivo' } });
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
 * Crea un middleware que verifica si el usuario tiene uno de los roles permitidos.
 *
 * Roles disponibles (definidos en Prisma schema):
 * - `ADMIN`: Administrador del negocio (rol más alto)
 * - `MOZO`: Camarero, gestiona mesas y pedidos
 * - `COCINERO`: Ve y gestiona pedidos en cocina
 * - `CAJERO`: Cobra pedidos
 * - `DELIVERY`: Gestiona entregas
 *
 * @param {...string} rolesPermitidos - Roles que pueden acceder a la ruta
 * @returns {import('express').RequestHandler} Middleware de verificación
 *
 * @example
 * // Solo admin
 * router.get('/reportes', verificarToken, verificarRol('ADMIN'), controller.get);
 *
 * // Admin o mozo
 * router.post('/pedidos', verificarToken, verificarRol('ADMIN', 'MOZO'), controller.create);
 *
 * // Cualquier rol (pero autenticado)
 * router.get('/mi-perfil', verificarToken, controller.getPerfil);
 */
const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: { message: 'No autenticado' } });
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({
        error: { message: 'No tienes permisos para realizar esta acción' }
      });
    }

    next();
  };
};

/**
 * Crea un middleware de autorización basado en capacidad de negocio.
 *
 * Permite centralizar las reglas RBAC en un único mapa de permisos.
 *
 * @param {string} capability - Capacidad definida en auth/permissions.js
 * @returns {import('express').RequestHandler} Middleware de verificación
 */
const verificarPermiso = (capability) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: { message: 'No autenticado' } });
    }

    const rolesPermitidos = rolesForCapability(capability);
    if (rolesPermitidos.length === 0) {
      return res.status(500).json({
        error: { message: `Capacidad no configurada: ${capability}` }
      });
    }

    if (!hasRoleForCapability(req.usuario.rol, capability)) {
      return res.status(403).json({
        error: { message: 'No tienes permisos para realizar esta acción' }
      });
    }

    return next();
  };
};

// ============================================================
// SHORTCUTS DE ROLES
// Middlewares preconfigurados para roles comunes
// ============================================================

/** Middleware: Solo rol ADMIN */
const esAdmin = verificarPermiso(CAPABILITY.ADMIN_ONLY);

/** Middleware: Rol ADMIN o CAJERO */
const esAdminOCajero = verificarPermiso(CAPABILITY.CASH_MANAGEMENT);

/** Middleware: Rol ADMIN o MOZO (para gestión de mesas y pedidos) */
const esMozo = verificarPermiso(CAPABILITY.TABLES_ACCESS);

/** Middleware: Rol ADMIN o DELIVERY (para gestión de entregas) */
const esDelivery = verificarPermiso(CAPABILITY.DELIVERY_ACCESS);

/** Middleware: Rol ADMIN o COCINERO (para pantalla de cocina) */
const esCocinero = verificarPermiso(CAPABILITY.KITCHEN_ACCESS);

module.exports = {
  verificarToken,
  verificarRol,
  verificarPermiso,
  esAdmin,
  esAdminOCajero,
  esMozo,
  esDelivery,
  esCocinero
};
