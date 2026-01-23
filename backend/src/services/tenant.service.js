const { createHttpError } = require('../utils/http-error');

// Slugs reservados que no se pueden usar
const RESERVED_SLUGS = [
  'admin', 'api', 'www', 'app', 'login', 'registro', 'register',
  'menu', 'dashboard', 'config', 'configuracion', 'settings',
  'super-admin', 'superadmin', 'root', 'system', 'public',
  'static', 'assets', 'uploads', 'images', 'css', 'js',
  'health', 'status', 'test', 'demo', 'example', 'default'
];

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

const validateSlug = async (prisma, slug, currentTenantId) => {
  if (!slug || slug.length < 3 || slug.length > 50) {
    return { valid: false, error: 'El slug debe tener entre 3 y 50 caracteres' };
  }

  if (!SLUG_REGEX.test(slug)) {
    return {
      valid: false,
      error: 'El slug solo puede contener letras minusculas, numeros y guiones (no al inicio ni al final)'
    };
  }

  if (RESERVED_SLUGS.includes(slug)) {
    return { valid: false, error: 'Este slug esta reservado y no puede usarse' };
  }

  const existingTenant = await prisma.tenant.findFirst({
    where: {
      slug,
      id: { not: currentTenantId }
    }
  });

  if (existingTenant) {
    return { valid: false, error: 'Este slug ya esta en uso por otro negocio' };
  }

  return { valid: true };
};

const obtenerTenant = async (prisma, tenantId) => {
  if (!tenantId) {
    throw createHttpError.badRequest('Tenant no identificado');
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      slug: true,
      nombre: true,
      email: true,
      telefono: true,
      direccion: true,
      logo: true,
      bannerUrl: true,
      colorPrimario: true,
      colorSecundario: true,
      plan: true,
      activo: true,
      createdAt: true
    }
  });

  if (!tenant) {
    throw createHttpError.notFound('Tenant no encontrado');
  }

  return tenant;
};

const actualizarTenant = async (prisma, tenantId, data) => {
  if (!tenantId) {
    throw createHttpError.badRequest('Tenant no identificado');
  }

  const tenantActual = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });

  if (!tenantActual) {
    throw createHttpError.notFound('Tenant no encontrado');
  }

  const slug = data.slug ? data.slug.toLowerCase().trim() : data.slug;
  const nombre = data.nombre !== undefined ? data.nombre.trim() : data.nombre;

  if (slug && slug !== tenantActual.slug) {
    const slugValidation = await validateSlug(prisma, slug, tenantId);
    if (!slugValidation.valid) {
      throw createHttpError.badRequest(slugValidation.error);
    }
  }

  const updateData = {};
  if (slug !== undefined) updateData.slug = slug;
  if (nombre !== undefined) updateData.nombre = nombre;
  if (data.email !== undefined) updateData.email = data.email.trim();
  if (data.telefono !== undefined) updateData.telefono = data.telefono?.trim() || null;
  if (data.direccion !== undefined) updateData.direccion = data.direccion?.trim() || null;
  if (data.colorPrimario !== undefined) updateData.colorPrimario = data.colorPrimario;
  if (data.colorSecundario !== undefined) updateData.colorSecundario = data.colorSecundario;

  const tenantActualizado = await prisma.tenant.update({
    where: { id: tenantId },
    data: updateData,
    select: {
      id: true,
      slug: true,
      nombre: true,
      email: true,
      telefono: true,
      direccion: true,
      logo: true,
      bannerUrl: true,
      colorPrimario: true,
      colorSecundario: true,
      plan: true,
      activo: true
    }
  });

  if (nombre !== undefined) {
    await prisma.configuracion.upsert({
      where: {
        tenantId_clave: { tenantId, clave: 'nombre_negocio' }
      },
      update: { valor: nombre },
      create: { tenantId, clave: 'nombre_negocio', valor: nombre }
    });
  }

  return {
    tenant: tenantActualizado,
    message: 'Datos actualizados correctamente',
    slugChanged: Boolean(slug && slug !== tenantActual.slug)
  };
};

const verificarSlug = async (prisma, tenantId, slug) => {
  const normalizedSlug = slug.toLowerCase().trim();
  const validation = await validateSlug(prisma, normalizedSlug, tenantId);

  return {
    slug: normalizedSlug,
    disponible: validation.valid,
    error: validation.error || null
  };
};

module.exports = {
  RESERVED_SLUGS,
  validateSlug,
  obtenerTenant,
  actualizarTenant,
  verificarSlug
};
