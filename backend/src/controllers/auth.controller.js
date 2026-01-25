const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma, getTenantBySlug } = require('../db/prisma');
const { createHttpError } = require('../utils/http-error');

/**
 * Registrar nuevo usuario (solo admin puede hacerlo)
 * Requires tenant context from middleware
 */
const registrar = async (req, res) => {
  const { email, password, nombre, rol } = req.body;
  const tenantId = req.tenantId;

  if (!tenantId) {
    throw createHttpError.badRequest('Contexto de tenant requerido');
  }

  // Verificar si el email ya existe en este tenant
  const existente = await prisma.usuario.findFirst({
    where: { tenantId, email }
  });

  if (existente) {
    throw createHttpError.badRequest('El email ya está registrado en este restaurante');
  }

  // Hashear password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // Crear usuario con tenantId
  const usuario = await prisma.usuario.create({
    data: {
      tenantId,
      email,
      password: passwordHash,
      nombre,
      rol: rol || 'MOZO'
    },
    select: { id: true, email: true, nombre: true, rol: true, activo: true, tenantId: true }
  });

  res.status(201).json(usuario);
};

/**
 * Login con slug de tenant
 * Supports both tenant-specific login and SUPER_ADMIN login
 */
const login = async (req, res) => {
  const { email, password, slug } = req.body;

  let usuario;
  let tenant = null;

  // If slug provided, find user within that tenant
  if (slug) {
    tenant = await getTenantBySlug(slug);

    if (!tenant) {
      throw createHttpError.notFound('Restaurante no encontrado');
    }

    if (!tenant.activo) {
      throw createHttpError.forbidden('Este restaurante no está activo');
    }

    // Find user in this specific tenant
    usuario = await prisma.usuario.findFirst({
      where: { tenantId: tenant.id, email }
    });
  } else {
    // No slug - try to find SUPER_ADMIN (tenantId is null)
    usuario = await prisma.usuario.findFirst({
      where: {
        email,
        tenantId: null,
        rol: 'SUPER_ADMIN'
      }
    });

    // If not found as SUPER_ADMIN, check if it's a unique email across all tenants
    // This is for backwards compatibility during migration
    if (!usuario) {
      const usuarios = await prisma.usuario.findMany({
        where: { email },
        include: { tenant: true }
      });

      if (usuarios.length === 1) {
        usuario = usuarios[0];
        tenant = usuario.tenant;

        // Check if tenant is active
        if (tenant && !tenant.activo) {
          throw createHttpError.forbidden('El restaurante asociado no está activo');
        }
      } else if (usuarios.length > 1) {
        throw createHttpError.badRequest('Múltiples cuentas encontradas. Por favor especifica el restaurante (slug)');
      }
    }
  }

  if (!usuario) {
    throw createHttpError.unauthorized('Credenciales inválidas');
  }

  // Verificar si está activo
  if (!usuario.activo) {
    throw createHttpError.unauthorized('Usuario inactivo');
  }

  // Verificar password
  const passwordValido = await bcrypt.compare(password, usuario.password);
  if (!passwordValido) {
    throw createHttpError.unauthorized('Credenciales inválidas');
  }

  // Generar token con tenantId
  const tokenPayload = {
    id: usuario.id,
    email: usuario.email,
    rol: usuario.rol,
    tenantId: usuario.tenantId
  };

  const token = jwt.sign(
    tokenPayload,
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  // Set JWT as httpOnly cookie for security (prevents XSS attacks)
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });

  // Build response (without token in body for security)
  const response = {
    usuario: {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      tenantId: usuario.tenantId
    }
  };

  // Include tenant info if available
  if (tenant) {
    response.tenant = {
      id: tenant.id,
      slug: tenant.slug,
      nombre: tenant.nombre,
      logo: tenant.logo,
      colorPrimario: tenant.colorPrimario,
      colorSecundario: tenant.colorSecundario
    };
  }

  res.json(response);
};

/**
 * Obtener perfil actual con info de tenant
 */
const perfil = async (req, res) => {
  const response = { ...req.usuario };

  // Include tenant info if user has one
  if (req.usuario.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.usuario.tenantId },
      select: {
        id: true,
        slug: true,
        nombre: true,
        logo: true,
        colorPrimario: true,
        colorSecundario: true
      }
    });

    if (tenant) {
      response.tenant = tenant;
    }
  }

  res.json(response);
};

/**
 * Cambiar contraseña
 */
const cambiarPassword = async (req, res) => {
  const { passwordActual, passwordNuevo } = req.body;

  const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
  if (!usuario) {
    throw createHttpError.unauthorized('Usuario no válido o inactivo');
  }

  const passwordValido = await bcrypt.compare(passwordActual, usuario.password);
  if (!passwordValido) {
    throw createHttpError.badRequest('Contraseña actual incorrecta');
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(passwordNuevo, salt);

  await prisma.usuario.update({
    where: { id: req.usuario.id },
    data: { password: passwordHash }
  });

  res.json({ message: 'Contraseña actualizada correctamente' });
};

/**
 * Logout - Clear authentication cookie
 */
const logout = async (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  res.json({ message: 'Sesión cerrada correctamente' });
};

module.exports = {
  registrar,
  login,
  logout,
  perfil,
  cambiarPassword
};
