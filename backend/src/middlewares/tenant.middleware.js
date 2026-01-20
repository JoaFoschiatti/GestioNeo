/**
 * Tenant Resolution Middleware
 *
 * This middleware resolves tenant context for requests:
 * - For authenticated routes: extracts tenantId from JWT
 * - For public routes: resolves tenant from URL slug
 */

const { prisma, getTenantPrisma, getTenantBySlug } = require('../db/prisma');

/**
 * Middleware to resolve tenant from URL slug (for public routes)
 * Expected route: /api/publico/:slug/...
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
 * Middleware to set tenant context from authenticated user
 * Must be used AFTER auth middleware (verificarToken)
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
 * Middleware to require SUPER_ADMIN role
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
 * Optional tenant context for routes that may or may not need tenant
 * (e.g., login endpoint where we resolve tenant from request body)
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

module.exports = {
  resolveTenantFromSlug,
  setTenantFromAuth,
  requireSuperAdmin,
  optionalTenantFromSlug
};
