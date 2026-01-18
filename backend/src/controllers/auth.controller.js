const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Registrar nuevo usuario (solo admin puede hacerlo)
const registrar = async (req, res) => {
  try {
    const { email, password, nombre, rol } = req.body;

    // Verificar si el email ya existe
    const existente = await prisma.usuario.findUnique({ where: { email } });
    if (existente) {
      return res.status(400).json({ error: { message: 'El email ya está registrado' } });
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
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: { message: 'Error al registrar usuario' } });
  }
};

// Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Buscar usuario
    const usuario = await prisma.usuario.findUnique({ where: { email } });
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

    // Generar token
    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: { message: 'Error al iniciar sesión' } });
  }
};

// Obtener perfil actual
const perfil = async (req, res) => {
  res.json(req.usuario);
};

// Cambiar contraseña
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
