const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Listar empleados
const listar = async (req, res) => {
  try {
    const { activo, rol } = req.query;

    const where = {};
    if (activo !== undefined) where.activo = activo === 'true';
    if (rol) where.rol = rol;

    const empleados = await prisma.empleado.findMany({
      where,
      orderBy: { nombre: 'asc' }
    });

    res.json(empleados);
  } catch (error) {
    console.error('Error al listar empleados:', error);
    res.status(500).json({ error: { message: 'Error al obtener empleados' } });
  }
};

// Obtener empleado por ID
const obtener = async (req, res) => {
  try {
    const { id } = req.params;

    const empleado = await prisma.empleado.findUnique({
      where: { id: parseInt(id) },
      include: {
        fichajes: { orderBy: { fecha: 'desc' }, take: 10 },
        liquidaciones: { orderBy: { createdAt: 'desc' }, take: 5 }
      }
    });

    if (!empleado) {
      return res.status(404).json({ error: { message: 'Empleado no encontrado' } });
    }

    res.json(empleado);
  } catch (error) {
    console.error('Error al obtener empleado:', error);
    res.status(500).json({ error: { message: 'Error al obtener empleado' } });
  }
};

// Crear empleado
const crear = async (req, res) => {
  try {
    const { nombre, apellido, dni, telefono, direccion, rol, tarifaHora } = req.body;

    // Verificar DNI único
    const existente = await prisma.empleado.findUnique({ where: { dni } });
    if (existente) {
      return res.status(400).json({ error: { message: 'Ya existe un empleado con ese DNI' } });
    }

    const empleado = await prisma.empleado.create({
      data: { nombre, apellido, dni, telefono, direccion, rol, tarifaHora }
    });

    res.status(201).json(empleado);
  } catch (error) {
    console.error('Error al crear empleado:', error);
    res.status(500).json({ error: { message: 'Error al crear empleado' } });
  }
};

// Actualizar empleado
const actualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, dni, telefono, direccion, rol, tarifaHora, activo } = req.body;

    // Verificar que existe
    const existe = await prisma.empleado.findUnique({ where: { id: parseInt(id) } });
    if (!existe) {
      return res.status(404).json({ error: { message: 'Empleado no encontrado' } });
    }

    // Verificar DNI único si cambió
    if (dni && dni !== existe.dni) {
      const dniExiste = await prisma.empleado.findUnique({ where: { dni } });
      if (dniExiste) {
        return res.status(400).json({ error: { message: 'Ya existe un empleado con ese DNI' } });
      }
    }

    const empleado = await prisma.empleado.update({
      where: { id: parseInt(id) },
      data: { nombre, apellido, dni, telefono, direccion, rol, tarifaHora, activo }
    });

    res.json(empleado);
  } catch (error) {
    console.error('Error al actualizar empleado:', error);
    res.status(500).json({ error: { message: 'Error al actualizar empleado' } });
  }
};

// Eliminar empleado (soft delete)
const eliminar = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.empleado.update({
      where: { id: parseInt(id) },
      data: { activo: false }
    });

    res.json({ message: 'Empleado desactivado correctamente' });
  } catch (error) {
    console.error('Error al eliminar empleado:', error);
    res.status(500).json({ error: { message: 'Error al eliminar empleado' } });
  }
};

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar
};
