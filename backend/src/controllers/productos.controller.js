const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Listar productos
const listar = async (req, res) => {
  try {
    const { categoriaId, disponible } = req.query;

    const where = {};
    if (categoriaId) where.categoriaId = parseInt(categoriaId);
    if (disponible !== undefined) where.disponible = disponible === 'true';

    const productos = await prisma.producto.findMany({
      where,
      include: {
        categoria: { select: { id: true, nombre: true } },
        ingredientes: { include: { ingrediente: true } }
      },
      orderBy: { nombre: 'asc' }
    });

    res.json(productos);
  } catch (error) {
    console.error('Error al listar productos:', error);
    res.status(500).json({ error: { message: 'Error al obtener productos' } });
  }
};

// Obtener producto por ID
const obtener = async (req, res) => {
  try {
    const { id } = req.params;

    const producto = await prisma.producto.findUnique({
      where: { id: parseInt(id) },
      include: {
        categoria: true,
        ingredientes: { include: { ingrediente: true } }
      }
    });

    if (!producto) {
      return res.status(404).json({ error: { message: 'Producto no encontrado' } });
    }

    res.json(producto);
  } catch (error) {
    console.error('Error al obtener producto:', error);
    res.status(500).json({ error: { message: 'Error al obtener producto' } });
  }
};

// Crear producto
const crear = async (req, res) => {
  try {
    const { nombre, descripcion, precio, categoriaId, disponible, destacado, ingredientes } = req.body;
    const imagen = req.file ? `/uploads/${req.file.filename}` : null;

    const producto = await prisma.producto.create({
      data: {
        nombre,
        descripcion,
        precio,
        imagen,
        categoriaId: parseInt(categoriaId),
        disponible: disponible !== false,
        destacado: destacado === true,
        ingredientes: ingredientes ? {
          create: ingredientes.map(ing => ({
            ingredienteId: ing.ingredienteId,
            cantidad: ing.cantidad
          }))
        } : undefined
      },
      include: { categoria: true, ingredientes: { include: { ingrediente: true } } }
    });

    res.status(201).json(producto);
  } catch (error) {
    console.error('Error al crear producto:', error);
    res.status(500).json({ error: { message: 'Error al crear producto' } });
  }
};

// Actualizar producto
const actualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, precio, categoriaId, disponible, destacado, ingredientes } = req.body;
    const imagen = req.file ? `/uploads/${req.file.filename}` : undefined;

    const existe = await prisma.producto.findUnique({ where: { id: parseInt(id) } });
    if (!existe) {
      return res.status(404).json({ error: { message: 'Producto no encontrado' } });
    }

    // Si se envían ingredientes, eliminar los anteriores y crear los nuevos
    if (ingredientes) {
      await prisma.productoIngrediente.deleteMany({
        where: { productoId: parseInt(id) }
      });
    }

    const producto = await prisma.producto.update({
      where: { id: parseInt(id) },
      data: {
        nombre,
        descripcion,
        precio,
        ...(imagen && { imagen }),
        ...(categoriaId && { categoriaId: parseInt(categoriaId) }),
        disponible,
        destacado,
        ...(ingredientes && {
          ingredientes: {
            create: ingredientes.map(ing => ({
              ingredienteId: ing.ingredienteId,
              cantidad: ing.cantidad
            }))
          }
        })
      },
      include: { categoria: true, ingredientes: { include: { ingrediente: true } } }
    });

    res.json(producto);
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ error: { message: 'Error al actualizar producto' } });
  }
};

// Cambiar disponibilidad
const cambiarDisponibilidad = async (req, res) => {
  try {
    const { id } = req.params;
    const { disponible } = req.body;

    const producto = await prisma.producto.update({
      where: { id: parseInt(id) },
      data: { disponible }
    });

    res.json(producto);
  } catch (error) {
    console.error('Error al cambiar disponibilidad:', error);
    res.status(500).json({ error: { message: 'Error al cambiar disponibilidad' } });
  }
};

// Eliminar producto
const eliminar = async (req, res) => {
  try {
    const { id } = req.params;

    // Soft delete: marcar como no disponible
    await prisma.producto.update({
      where: { id: parseInt(id) },
      data: { disponible: false }
    });

    res.json({ message: 'Producto desactivado correctamente' });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    res.status(500).json({ error: { message: 'Error al eliminar producto' } });
  }
};

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  cambiarDisponibilidad,
  eliminar
};
