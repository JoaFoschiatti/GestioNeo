/**
 * Controlador de Tenant
 * Permite al admin ver y editar los datos de su tenant
 */

const { prisma } = require('../db/prisma');

// Slugs reservados que no se pueden usar
const RESERVED_SLUGS = [
  'admin', 'api', 'www', 'app', 'login', 'registro', 'register',
  'menu', 'dashboard', 'config', 'configuracion', 'settings',
  'super-admin', 'superadmin', 'root', 'system', 'public',
  'static', 'assets', 'uploads', 'images', 'css', 'js',
  'health', 'status', 'test', 'demo', 'example', 'default'
];

// Regex para validar formato del slug
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

/**
 * Validar formato y disponibilidad del slug
 */
const validateSlug = async (slug, currentTenantId) => {
  // Validar formato
  if (!slug || slug.length < 3 || slug.length > 50) {
    return { valid: false, error: 'El slug debe tener entre 3 y 50 caracteres' };
  }

  if (!SLUG_REGEX.test(slug)) {
    return {
      valid: false,
      error: 'El slug solo puede contener letras minusculas, numeros y guiones (no al inicio ni al final)'
    };
  }

  // Verificar si es reservado
  if (RESERVED_SLUGS.includes(slug)) {
    return { valid: false, error: 'Este slug esta reservado y no puede usarse' };
  }

  // Verificar unicidad (excluyendo el tenant actual)
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

/**
 * GET /api/tenant
 * Obtener datos del tenant actual
 */
const obtenerTenant = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: { message: 'Tenant no identificado' } });
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
      return res.status(404).json({ error: { message: 'Tenant no encontrado' } });
    }

    res.json(tenant);
  } catch (error) {
    console.error('Error al obtener tenant:', error);
    res.status(500).json({ error: { message: 'Error al obtener datos del negocio' } });
  }
};

/**
 * PUT /api/tenant
 * Actualizar datos del tenant
 */
const actualizarTenant = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { slug, nombre, email, telefono, direccion, colorPrimario, colorSecundario } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: { message: 'Tenant no identificado' } });
    }

    // Obtener tenant actual para comparar
    const tenantActual = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenantActual) {
      return res.status(404).json({ error: { message: 'Tenant no encontrado' } });
    }

    // Si el slug cambió, validarlo
    if (slug && slug !== tenantActual.slug) {
      const slugValidation = await validateSlug(slug, tenantId);
      if (!slugValidation.valid) {
        return res.status(400).json({ error: { message: slugValidation.error } });
      }
    }

    // Validar nombre
    if (nombre !== undefined && (!nombre || nombre.trim().length < 2)) {
      return res.status(400).json({ error: { message: 'El nombre debe tener al menos 2 caracteres' } });
    }

    // Validar email si se proporciona
    if (email !== undefined && email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: { message: 'Email invalido' } });
      }
    }

    // Preparar datos a actualizar
    const updateData = {};
    if (slug !== undefined) updateData.slug = slug.toLowerCase().trim();
    if (nombre !== undefined) updateData.nombre = nombre.trim();
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (telefono !== undefined) updateData.telefono = telefono?.trim() || null;
    if (direccion !== undefined) updateData.direccion = direccion?.trim() || null;
    if (colorPrimario !== undefined) updateData.colorPrimario = colorPrimario;
    if (colorSecundario !== undefined) updateData.colorSecundario = colorSecundario;

    // Actualizar tenant
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

    // Si el nombre cambió, actualizar también en configuración para mantener sincronía
    if (nombre !== undefined) {
      await prisma.configuracion.upsert({
        where: {
          tenantId_clave: { tenantId, clave: 'nombre_negocio' }
        },
        update: { valor: nombre.trim() },
        create: { tenantId, clave: 'nombre_negocio', valor: nombre.trim() }
      });
    }

    res.json({
      tenant: tenantActualizado,
      message: 'Datos actualizados correctamente',
      slugChanged: slug && slug !== tenantActual.slug
    });
  } catch (error) {
    console.error('Error al actualizar tenant:', error);
    res.status(500).json({ error: { message: 'Error al actualizar datos del negocio' } });
  }
};

/**
 * GET /api/tenant/verificar-slug/:slug
 * Verificar disponibilidad de un slug
 */
const verificarSlug = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { slug } = req.params;

    const validation = await validateSlug(slug, tenantId);

    res.json({
      slug,
      disponible: validation.valid,
      error: validation.error || null
    });
  } catch (error) {
    console.error('Error al verificar slug:', error);
    res.status(500).json({ error: { message: 'Error al verificar slug' } });
  }
};

module.exports = {
  obtenerTenant,
  actualizarTenant,
  verificarSlug
};
