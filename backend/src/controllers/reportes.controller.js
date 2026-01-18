const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Dashboard - métricas generales
const dashboard = async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    // Pedidos de hoy
    const pedidosHoy = await prisma.pedido.findMany({
      where: {
        createdAt: { gte: hoy, lt: manana },
        estado: { not: 'CANCELADO' }
      }
    });

    const ventasHoy = pedidosHoy.reduce((sum, p) => sum + parseFloat(p.total), 0);

    // Pedidos pendientes
    const pedidosPendientes = await prisma.pedido.count({
      where: { estado: { in: ['PENDIENTE', 'EN_PREPARACION'] } }
    });

    // Mesas ocupadas
    const mesasOcupadas = await prisma.mesa.count({
      where: { estado: 'OCUPADA' }
    });

    const mesasTotal = await prisma.mesa.count({
      where: { activa: true }
    });

    // Alertas de stock
    const ingredientes = await prisma.ingrediente.findMany({ where: { activo: true } });
    const alertasStock = ingredientes.filter(
      ing => parseFloat(ing.stockActual) <= parseFloat(ing.stockMinimo)
    ).length;

    // Empleados trabajando (con fichaje abierto)
    const empleadosTrabajando = await prisma.fichaje.count({
      where: { salida: null }
    });

    res.json({
      ventasHoy,
      pedidosHoy: pedidosHoy.length,
      pedidosPendientes,
      mesasOcupadas,
      mesasTotal,
      alertasStock,
      empleadosTrabajando
    });
  } catch (error) {
    console.error('Error en dashboard:', error);
    res.status(500).json({ error: { message: 'Error al obtener dashboard' } });
  }
};

// Reporte de ventas
const ventasReporte = async (req, res) => {
  try {
    const { fechaDesde, fechaHasta, agrupacion } = req.query;

    if (!fechaDesde || !fechaHasta) {
      return res.status(400).json({ error: { message: 'Fechas requeridas' } });
    }

    const pedidos = await prisma.pedido.findMany({
      where: {
        createdAt: {
          gte: new Date(fechaDesde),
          lte: new Date(fechaHasta + 'T23:59:59')
        },
        estado: 'COBRADO'
      },
      include: {
        items: { include: { producto: { select: { nombre: true, categoriaId: true } } } },
        usuario: { select: { nombre: true } },
        pagos: true
      },
      orderBy: { createdAt: 'asc' }
    });

    // Totales generales
    const totalVentas = pedidos.reduce((sum, p) => sum + parseFloat(p.total), 0);
    const totalPedidos = pedidos.length;

    // Ventas por método de pago
    const ventasPorMetodo = {};
    for (const pedido of pedidos) {
      for (const pago of pedido.pagos) {
        if (!ventasPorMetodo[pago.metodo]) {
          ventasPorMetodo[pago.metodo] = 0;
        }
        ventasPorMetodo[pago.metodo] += parseFloat(pago.monto);
      }
    }

    // Ventas por tipo (mesa/delivery)
    const ventasPorTipo = pedidos.reduce((acc, p) => {
      if (!acc[p.tipo]) acc[p.tipo] = { cantidad: 0, total: 0 };
      acc[p.tipo].cantidad++;
      acc[p.tipo].total += parseFloat(p.total);
      return acc;
    }, {});

    res.json({
      periodo: { desde: fechaDesde, hasta: fechaHasta },
      totalVentas,
      totalPedidos,
      ticketPromedio: totalPedidos > 0 ? totalVentas / totalPedidos : 0,
      ventasPorMetodo,
      ventasPorTipo,
      pedidos
    });
  } catch (error) {
    console.error('Error en reporte de ventas:', error);
    res.status(500).json({ error: { message: 'Error al generar reporte' } });
  }
};

// Productos más vendidos
const productosMasVendidos = async (req, res) => {
  try {
    const { fechaDesde, fechaHasta, limite } = req.query;

    const where = {
      pedido: { estado: 'COBRADO' }
    };

    if (fechaDesde && fechaHasta) {
      where.pedido.createdAt = {
        gte: new Date(fechaDesde),
        lte: new Date(fechaHasta + 'T23:59:59')
      };
    }

    const items = await prisma.pedidoItem.groupBy({
      by: ['productoId'],
      _sum: { cantidad: true, subtotal: true },
      where,
      orderBy: { _sum: { cantidad: 'desc' } },
      take: parseInt(limite) || 10
    });

    // Obtener datos de los productos
    const productosIds = items.map(i => i.productoId);
    const productos = await prisma.producto.findMany({
      where: { id: { in: productosIds } },
      include: { categoria: { select: { nombre: true } } }
    });

    const resultado = items.map(item => {
      const producto = productos.find(p => p.id === item.productoId);
      return {
        producto: producto?.nombre || 'Producto eliminado',
        categoria: producto?.categoria?.nombre || '-',
        cantidadVendida: item._sum.cantidad,
        totalVentas: item._sum.subtotal
      };
    });

    res.json(resultado);
  } catch (error) {
    console.error('Error en productos más vendidos:', error);
    res.status(500).json({ error: { message: 'Error al generar reporte' } });
  }
};

// Ventas por mozo
const ventasPorMozo = async (req, res) => {
  try {
    const { fechaDesde, fechaHasta } = req.query;

    const where = { estado: 'COBRADO' };
    if (fechaDesde && fechaHasta) {
      where.createdAt = {
        gte: new Date(fechaDesde),
        lte: new Date(fechaHasta + 'T23:59:59')
      };
    }

    const pedidos = await prisma.pedido.groupBy({
      by: ['usuarioId'],
      _count: { id: true },
      _sum: { total: true },
      where,
      orderBy: { _sum: { total: 'desc' } }
    });

    // Filtrar nulls (pedidos del menú público no tienen usuarioId)
    const usuariosIds = pedidos.map(p => p.usuarioId).filter(id => id !== null);
    const usuarios = await prisma.usuario.findMany({
      where: { id: { in: usuariosIds } },
      select: { id: true, nombre: true }
    });

    const resultado = pedidos.map(p => {
      const usuario = usuarios.find(u => u.id === p.usuarioId);
      return {
        mozo: usuario?.nombre || (p.usuarioId === null ? 'Menú Público' : 'Usuario eliminado'),
        pedidos: p._count.id,
        totalVentas: p._sum.total
      };
    });

    res.json(resultado);
  } catch (error) {
    console.error('Error en ventas por mozo:', error);
    res.status(500).json({ error: { message: 'Error al generar reporte' } });
  }
};

// Reporte de inventario
const inventarioReporte = async (req, res) => {
  try {
    const ingredientes = await prisma.ingrediente.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' }
    });

    const reporte = ingredientes.map(ing => ({
      id: ing.id,
      nombre: ing.nombre,
      unidad: ing.unidad,
      stockActual: ing.stockActual,
      stockMinimo: ing.stockMinimo,
      estado: parseFloat(ing.stockActual) <= parseFloat(ing.stockMinimo) ? 'BAJO' : 'OK',
      valorEstimado: ing.costo ? parseFloat(ing.stockActual) * parseFloat(ing.costo) : null
    }));

    const resumen = {
      totalItems: reporte.length,
      itemsBajoStock: reporte.filter(r => r.estado === 'BAJO').length,
      valorTotalEstimado: reporte.reduce((sum, r) => sum + (r.valorEstimado || 0), 0)
    };

    res.json({ resumen, ingredientes: reporte });
  } catch (error) {
    console.error('Error en reporte de inventario:', error);
    res.status(500).json({ error: { message: 'Error al generar reporte' } });
  }
};

// Reporte de sueldos
const sueldosReporte = async (req, res) => {
  try {
    const { mes, anio } = req.query;

    const where = {};
    if (mes && anio) {
      const fechaInicio = new Date(anio, mes - 1, 1);
      const fechaFin = new Date(anio, mes, 0);
      where.periodoDesde = { gte: fechaInicio };
      where.periodoHasta = { lte: fechaFin };
    }

    const liquidaciones = await prisma.liquidacion.findMany({
      where,
      include: { empleado: { select: { nombre: true, apellido: true, rol: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const resumen = {
      totalLiquidaciones: liquidaciones.length,
      totalPagado: liquidaciones.filter(l => l.pagado).reduce((sum, l) => sum + parseFloat(l.totalPagar), 0),
      totalPendiente: liquidaciones.filter(l => !l.pagado).reduce((sum, l) => sum + parseFloat(l.totalPagar), 0),
      horasTotales: liquidaciones.reduce((sum, l) => sum + parseFloat(l.horasTotales), 0)
    };

    res.json({ resumen, liquidaciones });
  } catch (error) {
    console.error('Error en reporte de sueldos:', error);
    res.status(500).json({ error: { message: 'Error al generar reporte' } });
  }
};

module.exports = {
  dashboard,
  ventasReporte,
  productosMasVendidos,
  ventasPorMozo,
  inventarioReporte,
  sueldosReporte
};
