const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma, getTenantPrisma, getTenantBySlug } = require('../db/prisma');

/**
 * Registrar nuevo usuario (solo admin puede hacerlo)
 * Requires tenant context from middleware
 */
const registrar = async (req, res) => {
  try {
    const { email, password, nombre, rol } = req.body;
    const tenantId = req.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: { message: 'Contexto de tenant requerido' } });
    }

    // Verificar si el email ya existe en este tenant
    const existente = await prisma.usuario.findFirst({
      where: { tenantId, email }
    });

    if (existente) {
      return res.status(400).json({ error: { message: 'El email ya está registrado en este restaurante' } });
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
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: { message: 'Error al registrar usuario' } });
  }
};

/**
 * Login con slug de tenant
 * Supports both tenant-specific login and SUPER_ADMIN login
 */
const login = async (req, res) => {
  try {
    const { email, password, slug } = req.body;

    let usuario;
    let tenant = null;

    // If slug provided, find user within that tenant
    if (slug) {
      tenant = await getTenantBySlug(slug);

      if (!tenant) {
        return res.status(404).json({ error: { message: 'Restaurante no encontrado' } });
      }

      if (!tenant.activo) {
        return res.status(403).json({ error: { message: 'Este restaurante no está activo' } });
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
            return res.status(403).json({ error: { message: 'El restaurante asociado no está activo' } });
          }
        } else if (usuarios.length > 1) {
          return res.status(400).json({
            error: { message: 'Múltiples cuentas encontradas. Por favor especifica el restaurante (slug)' }
          });
        }
      }
    }

    if (!usuario) {
      return res.status(401).json({ error: { message: 'Credenciales inválidas' } });
    }

    // Verificar si está activo
    if (!usuario.activo) {
      return res.status(401).json({ error: { message: 'Usuario inactivo' } });
    }

    // Verificar password
    const passwordValido = await bcrypt.compare(password, usuario.password);
    if (!passwordValido) {
      return res.status(401).json({ error: { message: 'Credenciales inválidas' } });
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

    // Build response
    const response = {
      token,
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
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: { message: 'Error al iniciar sesión' } });
  }
};

/**
 * Obtener perfil actual con info de tenant
 */
const perfil = async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({ error: { message: 'Error al obtener perfil' } });
  }
};

/**
 * Cambiar contraseña
 */
const cambiarPassword = async (req, res) => {
  try {
    const { passwordActual, passwordNuevo } = req.body;

    const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });

    const passwordValido = await bcrypt.compare(passwordActual, usuario.password);
    if (!passwordValido) {
      return res.status(400).json({ error: { message: 'Contraseña actual incorrecta' } });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordNuevo, salt);

    await prisma.usuario.update({
      where: { id: req.usuario.id },
      data: { password: passwordHash }
    });

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Error al cambiar password:', error);
    res.status(500).json({ error: { message: 'Error al cambiar contraseña' } });
  }
};

module.exports = {
  registrar,
  login,
  perfil,
  cambiarPassword
};
