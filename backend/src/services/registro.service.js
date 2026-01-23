const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { createHttpError } = require('../utils/http-error');
const { RESERVED_SLUGS: TENANT_RESERVED_SLUGS } = require('./tenant.service');

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

const RESERVED_SLUGS = Array.from(new Set([
  ...TENANT_RESERVED_SLUGS,
  'null',
  'undefined',
  'help',
  'support'
]));

const normalizeSlug = (slug) => slug.toLowerCase().trim();
const isValidSlug = (slug) => SLUG_REGEX.test(slug);

const registrar = async (prisma, data) => {
  const normalizedSlug = normalizeSlug(data.slug);

  if (!isValidSlug(normalizedSlug)) {
    throw createHttpError.badRequest(
      'El slug debe tener entre 3 y 50 caracteres, solo letras minúsculas, números y guiones'
    );
  }

  if (RESERVED_SLUGS.includes(normalizedSlug)) {
    throw createHttpError.badRequest('Este nombre de restaurante no está disponible');
  }

  const existingTenant = await prisma.tenant.findUnique({
    where: { slug: normalizedSlug }
  });

  if (existingTenant) {
    throw createHttpError.badRequest('Este nombre de restaurante ya está en uso');
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const nombreRestaurante = data.nombreRestaurante.trim();
  const nombreAdmin = data.nombre.trim();
  const email = data.email.trim();

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        slug: normalizedSlug,
        nombre: nombreRestaurante,
        email,
        telefono: data.telefono ?? undefined,
        direccion: data.direccion ?? undefined,
        activo: false
      }
    });

    const usuario = await tx.usuario.create({
      data: {
        tenantId: tenant.id,
        email,
        password: passwordHash,
        nombre: nombreAdmin,
        rol: 'ADMIN',
        activo: false
      }
    });

    await tx.emailVerificacion.create({
      data: {
        tenantId: tenant.id,
        usuarioId: usuario.id,
        token: verificationToken,
        expiresAt: tokenExpiry
      }
    });

    const defaultConfigs = [
      { tenantId: tenant.id, clave: 'tienda_abierta', valor: 'true' },
      { tenantId: tenant.id, clave: 'horario_apertura', valor: '11:00' },
      { tenantId: tenant.id, clave: 'horario_cierre', valor: '23:00' },
      { tenantId: tenant.id, clave: 'costo_delivery', valor: '0' },
      { tenantId: tenant.id, clave: 'mercadopago_enabled', valor: 'false' },
      { tenantId: tenant.id, clave: 'nombre_negocio', valor: nombreRestaurante },
      { tenantId: tenant.id, clave: 'tagline_negocio', valor: '' }
    ];

    await tx.configuracion.createMany({ data: defaultConfigs });

    return { tenant, usuario };
  });

  return {
    tenant: {
      slug: result.tenant.slug,
      nombre: result.tenant.nombre
    },
    verification: {
      email,
      nombre: nombreAdmin,
      token: verificationToken,
      nombreRestaurante: result.tenant.nombre
    }
  };
};

const verificarEmail = async (prisma, token) => {
  const verificacion = await prisma.emailVerificacion.findUnique({
    where: { token },
    include: {
      tenant: true,
      usuario: true
    }
  });

  if (!verificacion) {
    throw createHttpError.badRequest('Token de verificación inválido');
  }

  if (verificacion.usedAt) {
    throw createHttpError.badRequest('Este enlace ya fue utilizado');
  }

  if (verificacion.expiresAt < new Date()) {
    throw createHttpError.badRequest('El enlace de verificación ha expirado. Por favor solicita uno nuevo.');
  }

  await prisma.$transaction([
    prisma.tenant.update({
      where: { id: verificacion.tenantId },
      data: { activo: true }
    }),
    prisma.usuario.update({
      where: { id: verificacion.usuarioId },
      data: { activo: true }
    }),
    prisma.emailVerificacion.update({
      where: { id: verificacion.id },
      data: { usedAt: new Date() }
    })
  ]);

  return {
    message: 'Email verificado correctamente. Tu restaurante ya está activo.',
    tenant: {
      slug: verificacion.tenant.slug,
      nombre: verificacion.tenant.nombre
    }
  };
};

const reenviarVerificacion = async (prisma, email) => {
  const message = 'Si el email está registrado, recibirás un nuevo enlace de verificación.';

  const usuario = await prisma.usuario.findFirst({
    where: {
      email,
      activo: false,
      rol: 'ADMIN'
    },
    include: {
      tenant: true
    }
  });

  if (!usuario || !usuario.tenant) {
    return { message, shouldSendEmail: false };
  }

  const verificationToken = crypto.randomBytes(32).toString('hex');
  const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.emailVerificacion.create({
    data: {
      tenantId: usuario.tenantId,
      usuarioId: usuario.id,
      token: verificationToken,
      expiresAt: tokenExpiry
    }
  });

  return {
    message,
    shouldSendEmail: true,
    verification: {
      email,
      nombre: usuario.nombre,
      token: verificationToken,
      nombreRestaurante: usuario.tenant.nombre
    }
  };
};

const verificarSlug = async (prisma, slug) => {
  const normalizedSlug = normalizeSlug(slug);

  if (!isValidSlug(normalizedSlug)) {
    return { disponible: false, razon: 'formato_invalido' };
  }

  if (RESERVED_SLUGS.includes(normalizedSlug)) {
    return { disponible: false, razon: 'reservado' };
  }

  const existingTenant = await prisma.tenant.findUnique({
    where: { slug: normalizedSlug }
  });

  return {
    disponible: !existingTenant,
    razon: existingTenant ? 'en_uso' : null
  };
};

module.exports = {
  RESERVED_SLUGS,
  isValidSlug,
  registrar,
  verificarEmail,
  reenviarVerificacion,
  verificarSlug
};

