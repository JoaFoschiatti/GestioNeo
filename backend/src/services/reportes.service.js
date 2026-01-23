const { createHttpError } = require('../utils/http-error');
const { decimalToNumber } = require('../utils/decimal');

const buildDateRange = (fechaDesde, fechaHasta) => {
  if (!fechaDesde || !fechaHasta) return null;

  const start = new Date(`${fechaDesde}T00:00:00`);
  const endExclusive = new Date(`${fechaHasta}T00:00:00`);
  endExclusive.setDate(endExclusive.getDate() + 1);

  return { gte: start, lt: endExclusive };
};

const dashboard = async (prisma, tenantId) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);

  const [
    pedidosHoyAgg,
    pedidosPendientes,
    mesasOcupadas,
    mesasTotal,
    ingredientes,
    empleadosTrabajando
  ] = await prisma.$transaction([
    prisma.pedido.aggregate({
      where: {
        tenantId,
        createdAt: { gte: hoy, lt: manana },
        estado: { not: 'CANCELADO' }
      },
      _sum: { total: true },
      _count: { id: true }
    }),
    prisma.pedido.count({
      where: { tenantId, estado: { in: ['PENDIENTE', 'EN_PREPARACION'] } }
    }),
    prisma.mesa.count({
      where: { tenantId, estado: 'OCUPADA' }
    }),
    prisma.mesa.count({
      where: { tenantId, activa: true }
    }),
    prisma.ingrediente.findMany({
      where: { tenantId, activo: true },
      select: { stockActual: true, stockMinimo: true }
    }),
    prisma.fichaje.count({
      where: { tenantId, salida: null }
    })
  ]);

  const ventasHoy = decimalToNumber(pedidosHoyAgg._sum.total);
  const pedidosHoy = pedidosHoyAgg._count.id;

  const alertasStock = ingredientes.filter(
    ing => decimalToNumber(ing.stockActual) <= decimalToNumber(ing.stockMinimo)
  ).length;

  return {
    ventasHoy,
    pedidosHoy,
    pedidosPendientes,
    mesasOcupadas,
    mesasTotal,
    alertasStock,
    empleadosTrabajando
  };
};

const ventasReporte = async (prisma, tenantId, query) => {
  const { fechaDesde, fechaHasta } = query;

  if (!fechaDesde || !fechaHasta) {
    throw createHttpError.badRequest('Fechas requeridas');
  }

  const range = buildDateRange(fechaDesde, fechaHasta);

  const pedidos = await prisma.pedido.findMany({
    where: {
      tenantId,
      createdAt: range,
      estado: 'COBRADO'
    },
    include: {
      items: { include: { producto: { select: { nombre: true, categoriaId: true } } } },
      usuario: { select: { nombre: true } },
      pagos: true
    },
    orderBy: { createdAt: 'asc' }
  });

  const totalVentas = pedidos.reduce((sum, p) => sum + decimalToNumber(p.total), 0);
  const totalPedidos = pedidos.length;

  const ventasPorMetodo = {};
  for (const pedido of pedidos) {
    for (const pago of pedido.pagos) {
      if (!ventasPorMetodo[pago.metodo]) {
        ventasPorMetodo[pago.metodo] = 0;
      }
      ventasPorMetodo[pago.metodo] += decimalToNumber(pago.monto);
    }
  }

  const ventasPorTipo = pedidos.reduce((acc, p) => {
    if (!acc[p.tipo]) acc[p.tipo] = { cantidad: 0, total: 0 };
    acc[p.tipo].cantidad++;
    acc[p.tipo].total += decimalToNumber(p.total);
    return acc;
  }, {});

  return {
    periodo: { desde: fechaDesde, hasta: fechaHasta },
    totalVentas,
    totalPedidos,
    ticketPromedio: totalPedidos > 0 ? totalVentas / totalPedidos : 0,
    ventasPorMetodo,
    ventasPorTipo,
    pedidos
  };
};

const productosMasVendidos = async (prisma, tenantId, query) => {
  const { fechaDesde, fechaHasta, limite, agruparPorBase } = query;

  const where = {
    tenantId,
    pedido: { estado: 'COBRADO' }
  };

  const range = buildDateRange(fechaDesde, fechaHasta);
  if (range) {
    where.pedido.createdAt = range;
  }

  const take = agruparPorBase ? undefined : (limite || 10);

  const items = await prisma.pedidoItem.groupBy({
    by: ['productoId'],
    _sum: { cantidad: true, subtotal: true },
    where,
    orderBy: { _sum: { cantidad: 'desc' } },
    take
  });

  const productosIds = items.map(i => i.productoId);
  const productos = await prisma.producto.findMany({
    where: { id: { in: productosIds } },
    include: {
      categoria: { select: { nombre: true } },
      productoBase: { select: { id: true, nombre: true } }
    }
  });

  const productosById = new Map(productos.map(p => [p.id, p]));

  if (agruparPorBase) {
    const agrupado = {};

    items.forEach(item => {
      const producto = productosById.get(item.productoId);
      if (!producto) return;

      const baseId = producto.productoBase?.id || producto.id;
      const baseName = producto.productoBase?.nombre || producto.nombre;

      if (!agrupado[baseId]) {
        agrupado[baseId] = {
          productoBaseId: baseId,
          producto: baseName,
          categoria: producto.categoria?.nombre || '-',
          cantidadVendida: 0,
          totalVentas: 0,
          variantes: []
        };
      }

      agrupado[baseId].cantidadVendida += item._sum.cantidad || 0;
      agrupado[baseId].totalVentas += decimalToNumber(item._sum.subtotal);

      if (producto.productoBase) {
        agrupado[baseId].variantes.push({
          nombre: producto.nombre,
          nombreVariante: producto.nombreVariante,
          cantidadVendida: item._sum.cantidad,
          totalVentas: item._sum.subtotal
        });
      }
    });

    return Object.values(agrupado)
      .sort((a, b) => b.cantidadVendida - a.cantidadVendida)
      .slice(0, limite || 10);
  }

  return items.map(item => {
    const producto = productosById.get(item.productoId);
    return {
      producto: producto?.nombre || 'Producto eliminado',
      categoria: producto?.categoria?.nombre || '-',
      cantidadVendida: item._sum.cantidad,
      totalVentas: item._sum.subtotal,
      esVariante: producto ? producto.productoBaseId !== null : false,
      productoBase: producto?.productoBase?.nombre || null
    };
  });
};

const ventasPorMozo = async (prisma, tenantId, query) => {
  const { fechaDesde, fechaHasta } = query;

  const where = { tenantId, estado: 'COBRADO' };

  const range = buildDateRange(fechaDesde, fechaHasta);
  if (range) {
    where.createdAt = range;
  }

  const pedidos = await prisma.pedido.groupBy({
    by: ['usuarioId'],
    _count: { id: true },
    _sum: { total: true },
    where,
    orderBy: { _sum: { total: 'desc' } }
  });

  const usuariosIds = pedidos.map(p => p.usuarioId).filter(id => id !== null);
  const usuarios = await prisma.usuario.findMany({
    where: { id: { in: usuariosIds } },
    select: { id: true, nombre: true }
  });

  const usuariosById = new Map(usuarios.map(u => [u.id, u]));

  return pedidos.map(p => {
    const usuario = p.usuarioId !== null ? usuariosById.get(p.usuarioId) : null;
    return {
      mozo: usuario?.nombre || (p.usuarioId === null ? 'Menú Público' : 'Usuario eliminado'),
      pedidos: p._count.id,
      totalVentas: p._sum.total
    };
  });
};

const inventarioReporte = async (prisma, tenantId) => {
  const ingredientes = await prisma.ingrediente.findMany({
    where: { tenantId, activo: true },
    orderBy: { nombre: 'asc' }
  });

  const reporte = ingredientes.map(ing => {
    const stockActual = decimalToNumber(ing.stockActual);
    const stockMinimo = decimalToNumber(ing.stockMinimo);

    return {
      id: ing.id,
      nombre: ing.nombre,
      unidad: ing.unidad,
      stockActual: ing.stockActual,
      stockMinimo: ing.stockMinimo,
      estado: stockActual <= stockMinimo ? 'BAJO' : 'OK',
      valorEstimado: ing.costo ? stockActual * decimalToNumber(ing.costo) : null
    };
  });

  const resumen = {
    totalItems: reporte.length,
    itemsBajoStock: reporte.filter(r => r.estado === 'BAJO').length,
    valorTotalEstimado: reporte.reduce((sum, r) => sum + (r.valorEstimado || 0), 0)
  };

  return { resumen, ingredientes: reporte };
};

const sueldosReporte = async (prisma, tenantId, query) => {
  const { mes, anio } = query;

  const where = { tenantId };
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
    totalPagado: liquidaciones.filter(l => l.pagado).reduce((sum, l) => sum + decimalToNumber(l.totalPagar), 0),
    totalPendiente: liquidaciones.filter(l => !l.pagado).reduce((sum, l) => sum + decimalToNumber(l.totalPagar), 0),
    horasTotales: liquidaciones.reduce((sum, l) => sum + decimalToNumber(l.horasTotales), 0)
  };

  return { resumen, liquidaciones };
};

const ventasPorProductoBase = async (prisma, tenantId, query) => {
  const { fechaDesde, fechaHasta, limite } = query;

  const where = {
    tenantId,
    pedido: { estado: 'COBRADO' }
  };

  const range = buildDateRange(fechaDesde, fechaHasta);
  if (range) {
    where.pedido.createdAt = range;
  }

  const items = await prisma.pedidoItem.findMany({
    where,
    include: {
      producto: {
        include: {
          productoBase: { select: { id: true, nombre: true } },
          categoria: { select: { nombre: true } }
        }
      }
    }
  });

  const agrupado = {};

  items.forEach(item => {
    const producto = item.producto;
    if (!producto) return;

    const baseId = producto.productoBase?.id || producto.id;
    const baseName = producto.productoBase?.nombre || producto.nombre;

    if (!agrupado[baseId]) {
      agrupado[baseId] = {
        productoBaseId: baseId,
        nombreBase: baseName,
        categoria: producto.categoria?.nombre || '-',
        cantidadTotal: 0,
        totalVentas: 0,
        variantes: {}
      };
    }

    agrupado[baseId].cantidadTotal += item.cantidad;
    agrupado[baseId].totalVentas += decimalToNumber(item.subtotal);

    const varianteKey = producto.nombreVariante || 'Base';
    if (!agrupado[baseId].variantes[varianteKey]) {
      agrupado[baseId].variantes[varianteKey] = {
        nombre: producto.nombre,
        nombreVariante: producto.nombreVariante,
        cantidad: 0,
        ventas: 0
      };
    }

    agrupado[baseId].variantes[varianteKey].cantidad += item.cantidad;
    agrupado[baseId].variantes[varianteKey].ventas += decimalToNumber(item.subtotal);
  });

  return Object.values(agrupado)
    .map(item => ({
      ...item,
      variantes: Object.values(item.variantes)
    }))
    .sort((a, b) => b.cantidadTotal - a.cantidadTotal)
    .slice(0, limite || 20);
};

const consumoInsumos = async (prisma, tenantId, query) => {
  const { fechaDesde, fechaHasta } = query;

  const where = {
    tenantId,
    pedido: { estado: 'COBRADO' }
  };

  const range = buildDateRange(fechaDesde, fechaHasta);
  if (range) {
    where.pedido.createdAt = range;
  }

  const items = await prisma.pedidoItem.findMany({
    where,
    include: {
      producto: {
        include: {
          ingredientes: {
            include: {
              ingrediente: true
            }
          }
        }
      }
    }
  });

  const consumoPorIngrediente = {};

  items.forEach(item => {
    const producto = item.producto;
    if (!producto || !producto.ingredientes) return;

    const multiplicador = decimalToNumber(producto.multiplicadorInsumos) || 1.0;

    producto.ingredientes.forEach(pi => {
      const ingrediente = pi.ingrediente;
      if (!ingrediente) return;

      const consumo = decimalToNumber(pi.cantidad) * item.cantidad * multiplicador;

      if (!consumoPorIngrediente[ingrediente.id]) {
        consumoPorIngrediente[ingrediente.id] = {
          ingredienteId: ingrediente.id,
          nombre: ingrediente.nombre,
          unidad: ingrediente.unidad,
          consumoTotal: 0,
          stockActual: decimalToNumber(ingrediente.stockActual),
          stockMinimo: decimalToNumber(ingrediente.stockMinimo),
          costo: ingrediente.costo ? decimalToNumber(ingrediente.costo) : null,
          detalleProductos: {}
        };
      }

      consumoPorIngrediente[ingrediente.id].consumoTotal += consumo;

      const productoKey = producto.nombre;
      if (!consumoPorIngrediente[ingrediente.id].detalleProductos[productoKey]) {
        consumoPorIngrediente[ingrediente.id].detalleProductos[productoKey] = {
          producto: producto.nombre,
          multiplicador,
          cantidad: 0,
          consumo: 0
        };
      }
      consumoPorIngrediente[ingrediente.id].detalleProductos[productoKey].cantidad += item.cantidad;
      consumoPorIngrediente[ingrediente.id].detalleProductos[productoKey].consumo += consumo;
    });
  });

  const resultado = Object.values(consumoPorIngrediente)
    .map(item => ({
      ...item,
      costoTotal: item.costo ? item.consumoTotal * item.costo : null,
      estado: item.stockActual <= item.stockMinimo ? 'BAJO' : 'OK',
      detalleProductos: Object.values(item.detalleProductos)
    }))
    .sort((a, b) => b.consumoTotal - a.consumoTotal);

  const resumen = {
    totalIngredientes: resultado.length,
    ingredientesBajoStock: resultado.filter(r => r.estado === 'BAJO').length,
    costoTotalEstimado: resultado.reduce((sum, r) => sum + (r.costoTotal || 0), 0)
  };

  return { resumen, ingredientes: resultado };
};

module.exports = {
  dashboard,
  ventasReporte,
  productosMasVendidos,
  ventasPorMozo,
  inventarioReporte,
  sueldosReporte,
  ventasPorProductoBase,
  consumoInsumos
};
