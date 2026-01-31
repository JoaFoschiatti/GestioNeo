const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../db/prisma');
const { createHttpError } = require('../utils/http-error');

/**
 * Registrar nuevo usuario (solo admin puede hacerlo)
 */
const registrar = async (req, res) => {
  const { email, password, nombre, rol } = req.body;

  // Verificar si el email ya existe
  const existente = await prisma.usuario.findUnique({
    where: { email }
  });

  if (existente) {
    throw createHttpError.badRequest('El email ya está registrado');
  }

  // Hashear password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // Crear usuario
  const usuario = await prisma.usuario.create({
    data: {
      email,
      password: passwordHash,
      nombre,
      rol: rol || 'MOZO'
    },
    select: { id: true, email: true, nombre: true, rol: true, activo: true }
  });

  res.status(201).json(usuario);
};

/**
 * Login
 */
const login = async (req, res) => {
  const { email, password } = req.body;

  // Buscar usuario por email
  const usuario = await prisma.usuario.findUnique({
    where: { email }
  });

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

  // Generar token
  const tokenPayload = {
    id: usuario.id,
    email: usuario.email,
    rol: usuario.rol
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

  // Obtener datos del negocio
  const negocio = await prisma.negocio.findUnique({
    where: { id: 1 },
    select: {
      id: true,
      nombre: true,
      email: true,
      logo: true,
      colorPrimario: true,
      colorSecundario: true
    }
  });

  // Obtener estado de suscripción
  const suscripcion = await prisma.suscripcion.findUnique({
    where: { id: 1 },
    select: { id: true, estado: true, fechaVencimiento: true, precioMensual: true }
  });

  const ahora = new Date();
  const tieneAcceso = suscripcion &&
    suscripcion.estado === 'ACTIVA' &&
    suscripcion.fechaVencimiento &&
    suscripcion.fechaVencimiento > ahora;

  res.json({
    usuario: {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol
    },
    negocio: negocio || null,
    suscripcion: suscripcion || { estado: 'SIN_SUSCRIPCION' },
    modoSoloLectura: !tieneAcceso
  });
};

/**
 * Obtener perfil actual con info de negocio y suscripción
 */
const perfil = async (req, res) => {
  // Obtener datos del negocio
  const negocio = await prisma.negocio.findUnique({
    where: { id: 1 },
    select: {
      id: true,
      nombre: true,
      email: true,
      logo: true,
      colorPrimario: true,
      colorSecundario: true
    }
  });

  // Obtener estado de suscripción
  const suscripcion = await prisma.suscripcion.findUnique({
    where: { id: 1 },
    select: { id: true, estado: true, fechaVencimiento: true, precioMensual: true }
  });

  const ahora = new Date();
  const tieneAcceso = suscripcion &&
    suscripcion.estado === 'ACTIVA' &&
    suscripcion.fechaVencimiento &&
    suscripcion.fechaVencimiento > ahora;

  res.json({
    ...req.usuario,
    negocio: negocio || null,
    suscripcion: suscripcion || { estado: 'SIN_SUSCRIPCION' },
    modoSoloLectura: !tieneAcceso
  });
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
