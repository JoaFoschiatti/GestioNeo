/**
 * Middleware de resolución de tenant para multi-tenancy.
 *
 * GestioNeo soporta múltiples restaurantes (tenants) en la misma instancia.
 * Cada tenant tiene sus propios datos completamente aislados.
 *
 * Este middleware resuelve el contexto del tenant de dos formas:
 *
 * 1. **Por JWT (rutas autenticadas)**: El tenantId viene en el token del usuario.
 *    Usar con: `setTenantFromAuth` después de `verificarToken`
 *
 * 2. **Por slug (rutas públicas)**: El slug viene en la URL `/menu/:slug`
 *    Usar con: `resolveTenantFromSlug`
 *
 * Una vez resuelto, el middleware:
 * - Agrega `req.tenantId` con el ID del tenant
 * - Agrega `req.tenant` con el objeto tenant completo
 * - Agrega `req.prisma` con un cliente Prisma que filtra automáticamente por tenant
 *
 * El cliente Prisma extendido usa Prisma Client Extensions para interceptar
 * TODAS las queries y agregar automáticamente `WHERE tenantId = X`.
 *
 * @module tenant.middleware
 */

const { prisma, getTenantPrisma, getTenantBySlug } = require('../db/prisma');
const { createHttpError } = require('../utils/http-error');

/**
 * Resuelve el tenant desde el slug en la URL.
 *
 * Para rutas públicas como `/api/publico/:slug/menu`
 *
 * Verifica que el tenant exista y esté activo antes de continuar.
 * Agrega al request: tenantId, tenantSlug, tenant, prisma (con scoping)
 *
 * @param {import('express').Request} req - Request con params.slug
 * @param {import('express').Response} res - Response de Express
 * @param {import('express').NextFunction} next - Siguiente middleware
 *
 * @example
 * // En routes/publico.routes.js
 * router.get('/:slug/menu', resolveTenantFromSlug, controller.getMenu);
 *
 * // En el controller, usar req.prisma
 * const productos = await req.prisma.producto.findMany();
 * // Solo retorna productos del tenant resuelto
 */
const resolveTenantFromSlug = async (req, res, next) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res.status(400).json({
        error: { message: 'Slug de restaurante requerido' }
      });
    }

    const tenant = await getTenantBySlug(slug);

    if (!tenant) {
      return res.status(404).json({
        error: { message: 'Restaurante no encontrado' }
      });
    }

    if (!tenant.activo) {
      return res.status(403).json({
        error: { message: 'Este restaurante no está activo' }
      });
    }

    // Attach tenant context to request
    req.tenantId = tenant.id;
    req.tenantSlug = tenant.slug;
    req.tenant = tenant;
    req.prisma = getTenantPrisma(tenant.id);

    return next();
  } catch (error) {
    console.error('Error resolviendo tenant por slug:', error);
    return res.status(500).json({
      error: { message: 'Error interno del servidor' }
    });
  }
};

/**
 * Establece el contexto de tenant desde el usuario autenticado.
 *
 * IMPORTANTE: Debe usarse DESPUÉS de `verificarToken`.
 *
 * Para usuarios normales: extrae tenantId del JWT y crea cliente Prisma con scoping.
 * Para SUPER_ADMIN: usa Prisma sin scoping (acceso a todos los tenants).
 *
 * @param {import('express').Request} req - Request con req.usuario (de verificarToken)
 * @param {import('express').Response} res - Response de Express
 * @param {import('express').NextFunction} next - Siguiente middleware
 *
 * @example
 * // En routes/productos.routes.js
 * router.get('/',
 *   verificarToken,      // Primero: valida JWT, agrega req.usuario
 *   setTenantFromAuth,   // Segundo: agrega req.prisma con scoping
 *   controller.listar
 * );
 *
 * // En el controller
 * const prisma = req.prisma; // Ya tiene filtro de tenant
 * const productos = await prisma.producto.findMany();
 */
const setTenantFromAuth = async (req, res, next) => {
  try {
    // SUPER_ADMIN can access without tenant context
    if (req.usuario && req.usuario.rol === 'SUPER_ADMIN') {
      req.isSuperAdmin = true;
      req.prisma = prisma; // Super admin uses unscoped prisma
      return next();
    }

    // Regular users must have a tenantId
    const tenantId = req.usuario?.tenantId;

    if (!tenantId) {
      return res.status(403).json({
        error: { message: 'Usuario sin tenant asignado' }
      });
    }

    // Verify tenant is active
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant || !tenant.activo) {
      return res.status(403).json({
        error: { message: 'El restaurante asociado no está activo' }
      });
    }

    // Attach tenant context to request
    req.tenantId = tenant.id;
    req.tenantSlug = tenant.slug;
    req.tenant = tenant;
    req.isSuperAdmin = false;
    req.prisma = getTenantPrisma(tenant.id);

    return next();
  } catch (error) {
    console.error('Error estableciendo contexto de tenant:', error);
    return res.status(500).json({
      error: { message: 'Error interno del servidor' }
    });
  }
};

/**
 * Requiere rol SUPER_ADMIN y proporciona acceso sin scoping de tenant.
 *
 * Para rutas de administración global como gestión de tenants.
 * Usa Prisma sin extensiones (acceso a todos los datos).
 *
 * @param {import('express').Request} req - Request con req.usuario
 * @param {import('express').Response} res - Response de Express
 * @param {import('express').NextFunction} next - Siguiente middleware
 *
 * @example
 * // En routes/tenants.routes.js
 * router.get('/', verificarToken, requireSuperAdmin, controller.listar);
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.usuario || req.usuario.rol !== 'SUPER_ADMIN') {
    return res.status(403).json({
      error: { message: 'Acceso denegado. Se requiere rol SUPER_ADMIN' }
    });
  }

  req.isSuperAdmin = true;
  req.prisma = prisma;
  return next();
};

/**
 * Resuelve tenant opcionalmente desde slug en body, query o params.
 *
 * Para rutas donde el tenant puede o no estar presente (ej: login).
 * Si no hay slug o el tenant no existe, continúa sin contexto de tenant.
 *
 * @param {import('express').Request} req - Request de Express
 * @param {import('express').Response} res - Response de Express
 * @param {import('express').NextFunction} next - Siguiente middleware
 *
 * @example
 * // En routes/auth.routes.js
 * router.post('/login', optionalTenantFromSlug, controller.login);
 *
 * // El body puede incluir slug: { email, password, slug: 'mi-restaurante' }
 */
const optionalTenantFromSlug = async (req, res, next) => {
  try {
    const slug = req.body?.slug || req.query?.slug || req.params?.slug;

    if (!slug) {
      // No slug provided, continue without tenant context
      return next();
    }

    const tenant = await getTenantBySlug(slug);

    if (tenant && tenant.activo) {
      req.tenantId = tenant.id;
      req.tenantSlug = tenant.slug;
      req.tenant = tenant;
      req.prisma = getTenantPrisma(tenant.id);
    }

    return next();
  } catch (error) {
    console.error('Error resolviendo tenant opcional:', error);
    return next(); // Continue even on error for optional resolution
  }
};

/**
 * Resuelve tenant desde el header `x-tenant-slug`.
 *
 * Usado por el Print Bridge y otros servicios externos que necesitan
 * identificar el tenant sin autenticación JWT.
 *
 * @param {import('express').Request} req - Request con header x-tenant-slug
 * @param {import('express').Response} _res - Response (no usado)
 * @param {import('express').NextFunction} next - Siguiente middleware
 *
 * @throws {HttpError} 400 - Si no hay header x-tenant-slug
 * @throws {HttpError} 404 - Si el tenant no existe
 * @throws {HttpError} 403 - Si el tenant no está activo
 *
 * @example
 * // Request del Print Bridge
 * // Headers: { 'x-tenant-slug': 'mi-restaurante' }
 * router.get('/print-jobs', setTenantFromSlugHeader, controller.getPendingJobs);
 */
const setTenantFromSlugHeader = async (req, _res, next) => {
  try {
    const rawSlug = req.headers['x-tenant-slug'];
    const slug = typeof rawSlug === 'string' ? rawSlug.trim() : null;

    if (!slug) {
      throw createHttpError.badRequest('Slug de restaurante requerido');
    }

    const tenant = await getTenantBySlug(slug);

    if (!tenant) {
      throw createHttpError.notFound('Restaurante no encontrado');
    }

    if (!tenant.activo) {
      throw createHttpError.forbidden('Este restaurante no está activo');
    }

    req.tenantId = tenant.id;
    req.tenantSlug = tenant.slug;
    req.tenant = tenant;
    req.isSuperAdmin = false;
    req.prisma = getTenantPrisma(tenant.id);

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  resolveTenantFromSlug,
  setTenantFromAuth,
  requireSuperAdmin,
  optionalTenantFromSlug,
  setTenantFromSlugHeader
};
