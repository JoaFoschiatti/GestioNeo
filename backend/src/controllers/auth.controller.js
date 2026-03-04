const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../db/prisma');
const { createHttpError } = require('../utils/http-error');
const { userCache } = require('../utils/cache');

// Hash bcrypt de "dummy-password" para igualar tiempos cuando no existe usuario.
const DUMMY_BCRYPT_HASH = '$2a$10$7EqJtq98hPqEX7fNZaFWoOHiQb6Pfw6TgJ4h1Lh4f6qfQ1q9H9l9u';

/**
 * Registrar nuevo usuario (solo admin puede hacerlo)
 */
const registrar = async (req, res) => {
  const { email, password, nombre, rol } = req.body;

  const existente = await prisma.usuario.findUnique({
    where: { email }
  });

  if (existente) {
    throw createHttpError.badRequest('El email ya está registrado');
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

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

  const usuario = await prisma.usuario.findUnique({
    where: { email }
  });

  if (!usuario) {
    await bcrypt.compare(password || '', DUMMY_BCRYPT_HASH);
    throw createHttpError.unauthorized('Credenciales inválidas');
  }

  if (!usuario.activo) {
    throw createHttpError.unauthorized('Usuario inactivo');
  }

  const passwordValido = await bcrypt.compare(password, usuario.password);
  if (!passwordValido) {
    throw createHttpError.unauthorized('Credenciales inválidas');
  }

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

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000
  });

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
 * Obtener perfil actual con info de negocio y suscripcion
 */
const perfil = async (req, res) => {
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
 * Cambiar password
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

  userCache.delete(req.usuario.id);

  res.json({ message: 'Contraseña actualizada correctamente' });
};

/**
 * Generar token SSE de corta duracion (30 segundos).
 */
const generarSseToken = async (req, res) => {
  const sseToken = jwt.sign(
    { id: req.usuario.id, purpose: 'sse' },
    process.env.JWT_SECRET,
    { expiresIn: '30s' }
  );

  res.json({ sseToken });
};

/**
 * Logout - Clear authentication cookie
 */
const logout = async (_req, res) => {
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
  cambiarPassword,
  generarSseToken
};
