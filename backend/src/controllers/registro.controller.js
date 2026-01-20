/**
 * Tenant Registration Controller
 *
 * Handles self-service tenant onboarding:
 * - Create new tenant
 * - Create admin user for tenant
 * - Send verification email
 * - Verify email token
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { prisma } = require('../db/prisma');
const emailService = require('../services/email.service');

/**
 * Validate slug format
 */
const isValidSlug = (slug) => {
  // Must be 3-50 chars, lowercase alphanumeric with hyphens
  const slugRegex = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;
  return slugRegex.test(slug);
};

/**
 * Reserved slugs that cannot be used
 */
const RESERVED_SLUGS = [
  'admin', 'api', 'www', 'app', 'login', 'registro',
  'super-admin', 'superadmin', 'system', 'root', 'null',
  'undefined', 'config', 'settings', 'help', 'support'
];

/**
 * Register a new tenant with admin user
 */
const registrar = async (req, res) => {
  try {
    const {
      slug,
      nombreRestaurante,
      email,
      password,
      nombreAdmin,
      telefono,
      direccion
    } = req.body;

    // Validate required fields
    if (!slug || !nombreRestaurante || !email || !password || !nombreAdmin) {
      return res.status(400).json({
        error: { message: 'Todos los campos requeridos deben estar completos' }
      });
    }

    // Validate slug format
    const normalizedSlug = slug.toLowerCase().trim();
    if (!isValidSlug(normalizedSlug)) {
      return res.status(400).json({
        error: {
          message: 'El slug debe tener entre 3 y 50 caracteres, solo letras minúsculas, números y guiones'
        }
      });
    }

    // Check reserved slugs
    if (RESERVED_SLUGS.includes(normalizedSlug)) {
      return res.status(400).json({
        error: { message: 'Este nombre de restaurante no está disponible' }
      });
    }

    // Check if slug already exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug: normalizedSlug }
    });

    if (existingTenant) {
      return res.status(400).json({
        error: { message: 'Este nombre de restaurante ya está en uso' }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: { message: 'El email no es válido' }
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        error: { message: 'La contraseña debe tener al menos 8 caracteres' }
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create tenant and admin user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create tenant (inactive until verified)
      const tenant = await tx.tenant.create({
        data: {
          slug: normalizedSlug,
          nombre: nombreRestaurante,
          email,
          telefono,
          direccion,
          activo: false
        }
      });

      // Create admin user for this tenant
      const usuario = await tx.usuario.create({
        data: {
          tenantId: tenant.id,
          email,
          password: passwordHash,
          nombre: nombreAdmin,
          rol: 'ADMIN',
          activo: false // Inactive until email verified
        }
      });

      // Create email verification token
      const verificacion = await tx.emailVerificacion.create({
        data: {
          tenantId: tenant.id,
          usuarioId: usuario.id,
          token: verificationToken,
          expiresAt: tokenExpiry
        }
      });

      // Create default configuration for tenant
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

      return { tenant, usuario, verificacion };
    });

    // Send verification email
    try {
      await emailService.sendVerificationEmail(
        email,
        nombreAdmin,
        verificationToken,
        result.tenant.nombre
      );
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      // Don't fail the registration, user can request a new email
    }

    res.status(201).json({
      message: 'Registro exitoso. Por favor verifica tu email para activar la cuenta.',
      tenant: {
        slug: result.tenant.slug,
        nombre: result.tenant.nombre
      }
    });
  } catch (error) {
    console.error('Error en registro de tenant:', error);
    res.status(500).json({ error: { message: 'Error al registrar el restaurante' } });
  }
};

/**
 * Verify email token and activate tenant
 */
const verificarEmail = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        error: { message: 'Token de verificación requerido' }
      });
    }

    // Find verification record
    const verificacion = await prisma.emailVerificacion.findUnique({
      where: { token },
      include: {
        tenant: true,
        usuario: true
      }
    });

    if (!verificacion) {
      return res.status(400).json({
        error: { message: 'Token de verificación inválido' }
      });
    }

    // Check if already used
    if (verificacion.usedAt) {
      return res.status(400).json({
        error: { message: 'Este enlace ya fue utilizado' }
      });
    }

    // Check if expired
    if (verificacion.expiresAt < new Date()) {
      return res.status(400).json({
        error: { message: 'El enlace de verificación ha expirado. Por favor solicita uno nuevo.' }
      });
    }

    // Activate tenant and user
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

    res.json({
      message: 'Email verificado correctamente. Tu restaurante ya está activo.',
      tenant: {
        slug: verificacion.tenant.slug,
        nombre: verificacion.tenant.nombre
      }
    });
  } catch (error) {
    console.error('Error en verificación de email:', error);
    res.status(500).json({ error: { message: 'Error al verificar el email' } });
  }
};

/**
 * Resend verification email
 */
const reenviarVerificacion = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: { message: 'Email requerido' }
      });
    }

    // Find user with this email that's not yet verified
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
      // Don't reveal if email exists or not
      return res.json({
        message: 'Si el email está registrado, recibirás un nuevo enlace de verificación.'
      });
    }

    // Generate new token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Create new verification record
    await prisma.emailVerificacion.create({
      data: {
        tenantId: usuario.tenantId,
        usuarioId: usuario.id,
        token: verificationToken,
        expiresAt: tokenExpiry
      }
    });

    // Send verification email
    try {
      await emailService.sendVerificationEmail(
        email,
        usuario.nombre,
        verificationToken,
        usuario.tenant.nombre
      );
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
    }

    res.json({
      message: 'Si el email está registrado, recibirás un nuevo enlace de verificación.'
    });
  } catch (error) {
    console.error('Error reenviando verificación:', error);
    res.status(500).json({ error: { message: 'Error al reenviar verificación' } });
  }
};

/**
 * Check if slug is available
 */
const verificarSlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const normalizedSlug = slug.toLowerCase().trim();

    // Check format
    if (!isValidSlug(normalizedSlug)) {
      return res.json({ disponible: false, razon: 'formato_invalido' });
    }

    // Check reserved
    if (RESERVED_SLUGS.includes(normalizedSlug)) {
      return res.json({ disponible: false, razon: 'reservado' });
    }

    // Check if exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug: normalizedSlug }
    });

    res.json({
      disponible: !existingTenant,
      razon: existingTenant ? 'en_uso' : null
    });
  } catch (error) {
    console.error('Error verificando slug:', error);
    res.status(500).json({ error: { message: 'Error al verificar disponibilidad' } });
  }
};

module.exports = {
  registrar,
  verificarEmail,
  reenviarVerificacion,
  verificarSlug
};
