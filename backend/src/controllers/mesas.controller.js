const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Listar mesas
const listar = async (req, res) => {
  try {
    const { estado, activa } = req.query;

    const where = {};
    if (estado) where.estado = estado;
    if (activa !== undefined) where.activa = activa === 'true';

    const mesas = await prisma.mesa.findMany({
      where,
      orderBy: { numero: 'asc' },
      include: {
        pedidos: {
          where: { estado: { notIn: ['COBRADO', 'CANCELADO'] } },
          take: 1
        }
      }
    });

    res.json(mesas);
  } catch (error) {
    console.error('Error al listar mesas:', error);
    res.status(500).json({ error: { message: 'Error al obtener mesas' } });
  }
};

// Obtener mesa por ID
const obtener = async (req, res) => {
  try {
    const { id } = req.params;

    const mesa = await prisma.mesa.findUnique({
      where: { id: parseInt(id) },
      include: {
        pedidos: {
          where: { estado: { notIn: ['COBRADO', 'CANCELADO'] } },
          include: { items: { include: { producto: true } } }
        }
      }
    });

    if (!mesa) {
      return res.status(404).json({ error: { message: 'Mesa no encontrada' } });
    }

    res.json(mesa);
  } catch (error) {
    console.error('Error al obtener mesa:', error);
    res.status(500).json({ error: { message: 'Error al obtener mesa' } });
  }
};

// Crear mesa
const crear = async (req, res) => {
  try {
    const { numero, zona, capacidad } = req.body;

    // Verificar número único
    const existente = await prisma.mesa.findUnique({ where: { numero } });
    if (existente) {
      return res.status(400).json({ error: { message: 'Ya existe una mesa con ese número' } });
    }

    const mesa = await prisma.mesa.create({
      data: { numero, zona, capacidad }
    });

    res.status(201).json(mesa);
  } catch (error) {
    console.error('Error al crear mesa:', error);
    res.status(500).json({ error: { message: 'Error al crear mesa' } });
  }
};

// Actualizar mesa
const actualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const { numero, zona, capacidad, estado, activa } = req.body;

    const existe = await prisma.mesa.findUnique({ where: { id: parseInt(id) } });
    if (!existe) {
      return res.status(404).json({ error: { message: 'Mesa no encontrada' } });
    }

    // Verificar número único si cambió
    if (numero && numero !== existe.numero) {
      const numeroExiste = await prisma.mesa.findUnique({ where: { numero } });
      if (numeroExiste) {
        return res.status(400).json({ error: { message: 'Ya existe una mesa con ese número' } });
      }
    }

    const mesa = await prisma.mesa.update({
      where: { id: parseInt(id) },
      data: { numero, zona, capacidad, estado, activa }
    });

    res.json(mesa);
  } catch (error) {
    console.error('Error al actualizar mesa:', error);
    res.status(500).json({ error: { message: 'Error al actualizar mesa' } });
  }
};

// Cambiar estado de mesa
const cambiarEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const mesa = await prisma.mesa.update({
      where: { id: parseInt(id) },
      data: { estado }
    });

    res.json(mesa);
  } catch (error) {
    console.error('Error al cambiar estado de mesa:', error);
    res.status(500).json({ error: { message: 'Error al cambiar estado' } });
  }
};

// Eliminar mesa (soft delete)
const eliminar = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.mesa.update({
      where: { id: parseInt(id) },
      data: { activa: false }
    });

    res.json({ message: 'Mesa desactivada correctamente' });
  } catch (error) {
    console.error('Error al eliminar mesa:', error);
    res.status(500).json({ error: { message: 'Error al eliminar mesa' } });
  }
};

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  cambiarEstado,
  eliminar
};
