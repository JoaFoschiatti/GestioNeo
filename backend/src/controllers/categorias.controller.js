const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Listar categorías
const listar = async (req, res) => {
  try {
    const { activa } = req.query;

    const where = {};
    if (activa !== undefined) where.activa = activa === 'true';

    const categorias = await prisma.categoria.findMany({
      where,
      orderBy: { orden: 'asc' },
      include: { _count: { select: { productos: true } } }
    });

    res.json(categorias);
  } catch (error) {
    console.error('Error al listar categorías:', error);
    res.status(500).json({ error: { message: 'Error al obtener categorías' } });
  }
};

// Listar categorías públicas (para carta)
const listarPublicas = async (req, res) => {
  try {
    const categorias = await prisma.categoria.findMany({
      where: { activa: true },
      orderBy: { orden: 'asc' },
      include: {
        productos: {
          where: { disponible: true },
          orderBy: { nombre: 'asc' }
        }
      }
    });

    res.json(categorias);
  } catch (error) {
    console.error('Error al listar categorías públicas:', error);
    res.status(500).json({ error: { message: 'Error al obtener menú' } });
  }
};

// Crear categoría
const crear = async (req, res) => {
  try {
    const { nombre, descripcion, orden } = req.body;

    const existente = await prisma.categoria.findUnique({ where: { nombre } });
    if (existente) {
      return res.status(400).json({ error: { message: 'Ya existe una categoría con ese nombre' } });
    }

    const categoria = await prisma.categoria.create({
      data: { nombre, descripcion, orden }
    });

    res.status(201).json(categoria);
  } catch (error) {
    console.error('Error al crear categoría:', error);
    res.status(500).json({ error: { message: 'Error al crear categoría' } });
  }
};

// Actualizar categoría
const actualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, orden, activa } = req.body;

    const existe = await prisma.categoria.findUnique({ where: { id: parseInt(id) } });
    if (!existe) {
      return res.status(404).json({ error: { message: 'Categoría no encontrada' } });
    }

    if (nombre && nombre !== existe.nombre) {
      const nombreExiste = await prisma.categoria.findUnique({ where: { nombre } });
      if (nombreExiste) {
        return res.status(400).json({ error: { message: 'Ya existe una categoría con ese nombre' } });
      }
    }

    const categoria = await prisma.categoria.update({
      where: { id: parseInt(id) },
      data: { nombre, descripcion, orden, activa }
    });

    res.json(categoria);
  } catch (error) {
    console.error('Error al actualizar categoría:', error);
    res.status(500).json({ error: { message: 'Error al actualizar categoría' } });
  }
};

// Eliminar categoría
const eliminar = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que no tenga productos
    const productos = await prisma.producto.count({ where: { categoriaId: parseInt(id) } });
    if (productos > 0) {
      return res.status(400).json({
        error: { message: 'No se puede eliminar: la categoría tiene productos asociados' }
      });
    }

    await prisma.categoria.delete({ where: { id: parseInt(id) } });

    res.json({ message: 'Categoría eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    res.status(500).json({ error: { message: 'Error al eliminar categoría' } });
  }
};

module.exports = {
  listar,
  listarPublicas,
  crear,
  actualizar,
  eliminar
};
