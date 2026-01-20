const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Listar modificadores
const listar = async (req, res) => {
  try {
    const { activo, tipo } = req.query;

    const where = {};
    if (activo !== undefined) where.activo = activo === 'true';
    if (tipo) where.tipo = tipo;

    const modificadores = await prisma.modificador.findMany({
      where,
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }]
    });

    res.json(modificadores);
  } catch (error) {
    console.error('Error al listar modificadores:', error);
    res.status(500).json({ error: { message: 'Error al obtener modificadores' } });
  }
};

// Obtener modificador por ID
const obtener = async (req, res) => {
  try {
    const { id } = req.params;

    const modificador = await prisma.modificador.findUnique({
      where: { id: parseInt(id) },
      include: {
        productos: {
          include: {
            producto: { select: { id: true, nombre: true } }
          }
        }
      }
    });

    if (!modificador) {
      return res.status(404).json({ error: { message: 'Modificador no encontrado' } });
    }

    res.json(modificador);
  } catch (error) {
    console.error('Error al obtener modificador:', error);
    res.status(500).json({ error: { message: 'Error al obtener modificador' } });
  }
};

// Crear modificador
const crear = async (req, res) => {
  try {
    const { nombre, precio, tipo } = req.body;

    const existente = await prisma.modificador.findUnique({ where: { nombre } });
    if (existente) {
      return res.status(400).json({
        error: { message: 'Ya existe un modificador con ese nombre' }
      });
    }

    // Exclusiones deben tener precio 0
    const precioFinal = tipo === 'EXCLUSION' ? 0 : parseFloat(precio) || 0;

    const modificador = await prisma.modificador.create({
      data: {
        nombre,
        precio: precioFinal,
        tipo
      }
    });

    res.status(201).json(modificador);
  } catch (error) {
    console.error('Error al crear modificador:', error);
    res.status(500).json({ error: { message: 'Error al crear modificador' } });
  }
};

// Actualizar modificador
const actualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, precio, tipo, activo } = req.body;

    const existe = await prisma.modificador.findUnique({ where: { id: parseInt(id) } });
    if (!existe) {
      return res.status(404).json({ error: { message: 'Modificador no encontrado' } });
    }

    if (nombre && nombre !== existe.nombre) {
      const nombreExiste = await prisma.modificador.findUnique({ where: { nombre } });
      if (nombreExiste) {
        return res.status(400).json({
          error: { message: 'Ya existe un modificador con ese nombre' }
        });
      }
    }

    const data = {};
    if (nombre !== undefined) data.nombre = nombre;
    if (tipo !== undefined) data.tipo = tipo;
    if (activo !== undefined) data.activo = activo;

    // Precio: exclusiones siempre 0
    if (precio !== undefined || tipo !== undefined) {
      const tipoFinal = tipo || existe.tipo;
      data.precio = tipoFinal === 'EXCLUSION' ? 0 : parseFloat(precio) || existe.precio;
    }

    const modificador = await prisma.modificador.update({
      where: { id: parseInt(id) },
      data
    });

    res.json(modificador);
  } catch (error) {
    console.error('Error al actualizar modificador:', error);
    res.status(500).json({ error: { message: 'Error al actualizar modificador' } });
  }
};

// Eliminar modificador
const eliminar = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.modificador.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Modificador eliminado' });
  } catch (error) {
    console.error('Error al eliminar modificador:', error);
    res.status(500).json({ error: { message: 'Error al eliminar modificador' } });
  }
};

// Asignar modificadores a un producto
const asignarAProducto = async (req, res) => {
  try {
    const { productoId } = req.params;
    const { modificadorIds } = req.body;

    // Eliminar asignaciones existentes
    await prisma.productoModificador.deleteMany({
      where: { productoId: parseInt(productoId) }
    });

    // Crear nuevas asignaciones
    if (modificadorIds && modificadorIds.length > 0) {
      await prisma.productoModificador.createMany({
        data: modificadorIds.map(modId => ({
          productoId: parseInt(productoId),
          modificadorId: modId
        }))
      });
    }

    // Retornar producto con modificadores
    const producto = await prisma.producto.findUnique({
      where: { id: parseInt(productoId) },
      include: {
        modificadores: {
          include: { modificador: true }
        }
      }
    });

    res.json(producto);
  } catch (error) {
    console.error('Error al asignar modificadores:', error);
    res.status(500).json({ error: { message: 'Error al asignar modificadores' } });
  }
};

// Obtener modificadores de un producto
const modificadoresDeProducto = async (req, res) => {
  try {
    const { productoId } = req.params;

    const producto = await prisma.producto.findUnique({
      where: { id: parseInt(productoId) },
      include: {
        modificadores: {
          include: {
            modificador: true
          }
        }
      }
    });

    if (!producto) {
      return res.status(404).json({ error: { message: 'Producto no encontrado' } });
    }

    const modificadores = producto.modificadores.map(pm => pm.modificador);
    res.json(modificadores);
  } catch (error) {
    console.error('Error al obtener modificadores del producto:', error);
    res.status(500).json({ error: { message: 'Error al obtener modificadores' } });
  }
};

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
  asignarAProducto,
  modificadoresDeProducto
};
