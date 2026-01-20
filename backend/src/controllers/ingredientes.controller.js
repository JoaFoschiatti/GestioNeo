const { PrismaClient } = require('@prisma/client');
const eventBus = require('../services/event-bus');
const prisma = new PrismaClient();

// Función para verificar y habilitar productos cuando hay stock disponible
const verificarProductosDisponibles = async (ingredienteId) => {
  // Buscar productos NO disponibles que usan este ingrediente
  const productosNoDisponibles = await prisma.producto.findMany({
    where: {
      disponible: false,
      ingredientes: {
        some: { ingredienteId }
      }
    },
    include: {
      ingredientes: {
        include: { ingrediente: true }
      }
    }
  });

  const productosHabilitados = [];

  for (const producto of productosNoDisponibles) {
    // Verificar si TODOS los ingredientes del producto tienen stock > 0
    const todosConStock = producto.ingredientes.every(
      pi => parseFloat(pi.ingrediente.stockActual) > 0
    );

    if (todosConStock) {
      await prisma.producto.update({
        where: { id: producto.id },
        data: { disponible: true }
      });

      productosHabilitados.push(producto);

      eventBus.publish('producto.disponible', {
        id: producto.id,
        nombre: producto.nombre,
        motivo: 'Stock repuesto',
        updatedAt: new Date().toISOString()
      });
    }
  }

  if (productosHabilitados.length > 0) {
    console.log(`Productos habilitados: ${productosHabilitados.map(p => p.nombre).join(', ')}`);
  }

  return productosHabilitados;
};

// Listar ingredientes
const listar = async (req, res) => {
  try {
    const { activo, stockBajo } = req.query;

    let where = {};
    if (activo !== undefined) where.activo = activo === 'true';

    let ingredientes = await prisma.ingrediente.findMany({
      where,
      orderBy: { nombre: 'asc' }
    });

    // Filtrar por stock bajo si se solicita
    if (stockBajo === 'true') {
      ingredientes = ingredientes.filter(
        ing => parseFloat(ing.stockActual) <= parseFloat(ing.stockMinimo)
      );
    }

    res.json(ingredientes);
  } catch (error) {
    console.error('Error al listar ingredientes:', error);
    res.status(500).json({ error: { message: 'Error al obtener ingredientes' } });
  }
};

// Obtener ingrediente por ID
const obtener = async (req, res) => {
  try {
    const { id } = req.params;

    const ingrediente = await prisma.ingrediente.findUnique({
      where: { id: parseInt(id) },
      include: {
        movimientos: {
          orderBy: { createdAt: 'desc' },
          take: 20
        },
        productos: {
          include: { producto: { select: { nombre: true } } }
        }
      }
    });

    if (!ingrediente) {
      return res.status(404).json({ error: { message: 'Ingrediente no encontrado' } });
    }

    res.json(ingrediente);
  } catch (error) {
    console.error('Error al obtener ingrediente:', error);
    res.status(500).json({ error: { message: 'Error al obtener ingrediente' } });
  }
};

// Crear ingrediente
const crear = async (req, res) => {
  try {
    const { nombre, unidad, stockActual, stockMinimo, costo } = req.body;

    const existente = await prisma.ingrediente.findUnique({ where: { nombre } });
    if (existente) {
      return res.status(400).json({ error: { message: 'Ya existe un ingrediente con ese nombre' } });
    }

    const ingrediente = await prisma.ingrediente.create({
      data: { nombre, unidad, stockActual, stockMinimo, costo }
    });

    // Registrar movimiento inicial si hay stock
    if (parseFloat(stockActual) > 0) {
      await prisma.movimientoStock.create({
        data: {
          ingredienteId: ingrediente.id,
          tipo: 'ENTRADA',
          cantidad: stockActual,
          motivo: 'Stock inicial'
        }
      });
    }

    res.status(201).json(ingrediente);
  } catch (error) {
    console.error('Error al crear ingrediente:', error);
    res.status(500).json({ error: { message: 'Error al crear ingrediente' } });
  }
};

// Actualizar ingrediente
const actualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, unidad, stockMinimo, costo, activo } = req.body;

    const existe = await prisma.ingrediente.findUnique({ where: { id: parseInt(id) } });
    if (!existe) {
      return res.status(404).json({ error: { message: 'Ingrediente no encontrado' } });
    }

    if (nombre && nombre !== existe.nombre) {
      const nombreExiste = await prisma.ingrediente.findUnique({ where: { nombre } });
      if (nombreExiste) {
        return res.status(400).json({ error: { message: 'Ya existe un ingrediente con ese nombre' } });
      }
    }

    const ingrediente = await prisma.ingrediente.update({
      where: { id: parseInt(id) },
      data: { nombre, unidad, stockMinimo, costo, activo }
    });

    res.json(ingrediente);
  } catch (error) {
    console.error('Error al actualizar ingrediente:', error);
    res.status(500).json({ error: { message: 'Error al actualizar ingrediente' } });
  }
};

// Registrar movimiento de stock
const registrarMovimiento = async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo, cantidad, motivo } = req.body;

    const ingrediente = await prisma.ingrediente.findUnique({ where: { id: parseInt(id) } });
    if (!ingrediente) {
      return res.status(404).json({ error: { message: 'Ingrediente no encontrado' } });
    }

    // Actualizar stock
    const nuevoStock = tipo === 'ENTRADA'
      ? parseFloat(ingrediente.stockActual) + parseFloat(cantidad)
      : parseFloat(ingrediente.stockActual) - parseFloat(cantidad);

    if (nuevoStock < 0) {
      return res.status(400).json({ error: { message: 'Stock insuficiente' } });
    }

    await prisma.$transaction([
      prisma.ingrediente.update({
        where: { id: parseInt(id) },
        data: { stockActual: nuevoStock }
      }),
      prisma.movimientoStock.create({
        data: {
          ingredienteId: parseInt(id),
          tipo,
          cantidad,
          motivo
        }
      })
    ]);

    const ingredienteActualizado = await prisma.ingrediente.findUnique({
      where: { id: parseInt(id) }
    });

    // Si es entrada de stock, verificar si productos pueden volver a estar disponibles
    if (tipo === 'ENTRADA' && nuevoStock > 0) {
      await verificarProductosDisponibles(parseInt(id));
    }

    res.json(ingredienteActualizado);
  } catch (error) {
    console.error('Error al registrar movimiento:', error);
    res.status(500).json({ error: { message: 'Error al registrar movimiento' } });
  }
};

// Ajustar stock (inventario)
const ajustarStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { stockReal, motivo } = req.body;

    const ingrediente = await prisma.ingrediente.findUnique({ where: { id: parseInt(id) } });
    if (!ingrediente) {
      return res.status(404).json({ error: { message: 'Ingrediente no encontrado' } });
    }

    const diferencia = parseFloat(stockReal) - parseFloat(ingrediente.stockActual);

    await prisma.$transaction([
      prisma.ingrediente.update({
        where: { id: parseInt(id) },
        data: { stockActual: stockReal }
      }),
      prisma.movimientoStock.create({
        data: {
          ingredienteId: parseInt(id),
          tipo: 'AJUSTE',
          cantidad: Math.abs(diferencia),
          motivo: motivo || `Ajuste de inventario (${diferencia >= 0 ? '+' : ''}${diferencia})`
        }
      })
    ]);

    const ingredienteActualizado = await prisma.ingrediente.findUnique({
      where: { id: parseInt(id) }
    });

    // Si el stock aumentó, verificar si productos pueden volver a estar disponibles
    if (diferencia > 0 && parseFloat(stockReal) > 0) {
      await verificarProductosDisponibles(parseInt(id));
    }

    res.json(ingredienteActualizado);
  } catch (error) {
    console.error('Error al ajustar stock:', error);
    res.status(500).json({ error: { message: 'Error al ajustar stock' } });
  }
};

// Alertas de stock bajo
const alertasStock = async (req, res) => {
  try {
    const ingredientes = await prisma.ingrediente.findMany({
      where: { activo: true }
    });

    const alertas = ingredientes.filter(
      ing => parseFloat(ing.stockActual) <= parseFloat(ing.stockMinimo)
    );

    res.json(alertas);
  } catch (error) {
    console.error('Error al obtener alertas:', error);
    res.status(500).json({ error: { message: 'Error al obtener alertas' } });
  }
};

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  registrarMovimiento,
  ajustarStock,
  alertasStock
};
