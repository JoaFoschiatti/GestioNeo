/**
 * Servicio de reportes y estadísticas para Comanda.
 *
 * Este servicio genera reportes analíticos del restaurante:
 * - Dashboard con métricas en tiempo real
 * - Reporte de ventas por período
 * - Productos más vendidos (con soporte para variantes)
 * - Ventas por mozo/empleado
 * - Estado del inventario
 * - Liquidaciones y sueldos
 * - Consumo de insumos/ingredientes
 *
 * Todos los reportes están aislados por tenant (multi-tenancy).
 *
 * @module reportes.service
 */

const { createHttpError } = require('../utils/http-error');
const { decimalToNumber } = require('../utils/decimal');

/**
 * Construye un rango de fechas para filtros de Prisma.
 *
 * @private
 * @param {string} fechaDesde - Fecha inicio formato YYYY-MM-DD
 * @param {string} fechaHasta - Fecha fin formato YYYY-MM-DD (inclusive)
 * @returns {Object|null} Objeto { gte, lt } para Prisma o null si no hay fechas
 *
 * @example
 * // Retorna rango que incluye todo el 15 y 16 de enero
 * buildDateRange('2024-01-15', '2024-01-16')
 * // { gte: Date(2024-01-15 00:00), lt: Date(2024-01-17 00:00) }
 */
const buildDateRange = (fechaDesde, fechaHasta) => {
  if (!fechaDesde || !fechaHasta) return null;

  const start = new Date(`${fechaDesde}T00:00:00`);
  const endExclusive = new Date(`${fechaHasta}T00:00:00`);
  endExclusive.setDate(endExclusive.getDate() + 1);

  return { gte: start, lt: endExclusive };
};

/**
 * Obtiene métricas del dashboard en tiempo real.
 *
 * Ejecuta múltiples consultas en una transacción para obtener
 * el estado actual del restaurante de forma eficiente.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma con scoping
 * @param {number} tenantId - ID del tenant
 *
 * @returns {Promise<Object>} Métricas del dashboard
 * @returns {number} returns.ventasHoy - Total vendido hoy (solo pedidos COBRADO)
 * @returns {number} returns.pedidosHoy - Cantidad de pedidos hoy (excluye CANCELADO)
 * @returns {number} returns.pedidosPendientes - Pedidos PENDIENTE o EN_PREPARACION
 * @returns {number} returns.mesasOcupadas - Mesas con estado OCUPADA
 * @returns {number} returns.mesasTotal - Total de mesas activas
 * @returns {number} returns.alertasStock - Ingredientes con stock <= mínimo
 * @returns {number} returns.empleadosTrabajando - Fichajes abiertos (sin salida)
 *
 * @example
 * const stats = await dashboard(prisma, 1);
 * // {
 * //   ventasHoy: 45000,
 * //   pedidosHoy: 25,
 * //   pedidosPendientes: 3,
 * //   mesasOcupadas: 8,
 * //   mesasTotal: 15,
 * //   alertasStock: 2,
 * //   empleadosTrabajando: 5
 * // }
 */
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

/**
 * Genera reporte detallado de ventas por período.
 *
 * Incluye solo pedidos COBRADOS y agrupa por método de pago y tipo de pedido.
 * Retorna también los pedidos individuales para análisis detallado.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma con scoping
 * @param {number} tenantId - ID del tenant
 * @param {Object} query - Parámetros del reporte
 * @param {string} query.fechaDesde - Fecha inicio formato YYYY-MM-DD (requerido)
 * @param {string} query.fechaHasta - Fecha fin formato YYYY-MM-DD (requerido)
 *
 * @returns {Promise<Object>} Reporte de ventas
 * @returns {Object} returns.periodo - { desde, hasta }
 * @returns {number} returns.totalVentas - Suma total de ventas
 * @returns {number} returns.totalPedidos - Cantidad de pedidos cobrados
 * @returns {number} returns.ticketPromedio - totalVentas / totalPedidos
 * @returns {Object} returns.ventasPorMetodo - { EFECTIVO: 10000, MERCADOPAGO: 5000, ... }
 * @returns {Object} returns.ventasPorTipo - { MESA: { cantidad, total }, DELIVERY: {...}, ... }
 * @returns {Array} returns.pedidos - Lista de pedidos con items, usuario y pagos
 *
 * @throws {HttpError} 400 - Si no se proporcionan las fechas
 *
 * @example
 * const reporte = await ventasReporte(prisma, 1, {
 *   fechaDesde: '2024-01-01',
 *   fechaHasta: '2024-01-31'
 * });
 * // {
 * //   periodo: { desde: '2024-01-01', hasta: '2024-01-31' },
 * //   totalVentas: 250000,
 * //   totalPedidos: 150,
 * //   ticketPromedio: 1666.67,
 * //   ventasPorMetodo: { EFECTIVO: 150000, MERCADOPAGO: 100000 },
 * //   ventasPorTipo: { MESA: { cantidad: 100, total: 180000 }, DELIVERY: {...} },
 * //   pedidos: [...]
 * // }
 */
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

/**
 * Obtiene ranking de productos más vendidos.
 *
 * Puede agrupar variantes bajo su producto base o mostrarlas separadas.
 * Solo cuenta items de pedidos COBRADOS.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma con scoping
 * @param {number} tenantId - ID del tenant
 * @param {Object} query - Parámetros del reporte
 * @param {string} [query.fechaDesde] - Fecha inicio formato YYYY-MM-DD
 * @param {string} [query.fechaHasta] - Fecha fin formato YYYY-MM-DD
 * @param {number} [query.limite=10] - Máximo de productos a retornar
 * @param {boolean} [query.agruparPorBase=false] - Si true, agrupa variantes bajo producto base
 *
 * @returns {Promise<Array>} Lista de productos ordenados por ventas
 *
 * @example
 * // Sin agrupar variantes
 * const top = await productosMasVendidos(prisma, 1, { limite: 5 });
 * // [
 * //   { producto: 'Hamburguesa Clásica', categoria: 'Hamburguesas',
 * //     cantidadVendida: 150, totalVentas: 225000,
 * //     esVariante: false, productoBase: null },
 * //   { producto: 'Hamburguesa Doble', categoria: 'Hamburguesas',
 * //     cantidadVendida: 120, totalVentas: 240000,
 * //     esVariante: true, productoBase: 'Hamburguesa' },
 * //   ...
 * // ]
 *
 * @example
 * // Agrupando variantes
 * const topAgrupado = await productosMasVendidos(prisma, 1, {
 *   agruparPorBase: true,
 *   limite: 5
 * });
 * // [
 * //   { productoBaseId: 1, producto: 'Hamburguesa', categoria: 'Hamburguesas',
 * //     cantidadVendida: 270, totalVentas: 465000,
 * //     variantes: [
 * //       { nombre: 'Hamburguesa Clásica', nombreVariante: 'Clásica', ... },
 * //       { nombre: 'Hamburguesa Doble', nombreVariante: 'Doble', ... }
 * //     ] },
 * //   ...
 * // ]
 */
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
    orderBy: { _sum: { subtotal: 'desc' } },
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

/**
 * Obtiene ventas agrupadas por mozo/empleado.
 *
 * Útil para evaluar rendimiento de empleados y calcular comisiones.
 * Incluye pedidos sin usuario (Menú Público).
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma con scoping
 * @param {number} tenantId - ID del tenant
 * @param {Object} query - Parámetros del reporte
 * @param {string} [query.fechaDesde] - Fecha inicio formato YYYY-MM-DD
 * @param {string} [query.fechaHasta] - Fecha fin formato YYYY-MM-DD
 *
 * @returns {Promise<Array>} Lista de mozos con sus ventas, ordenados por total
 *
 * @example
 * const ventasMozos = await ventasPorMozo(prisma, 1, {
 *   fechaDesde: '2024-01-01',
 *   fechaHasta: '2024-01-31'
 * });
 * // [
 * //   { mozo: 'Juan Pérez', pedidos: 45, totalVentas: 67500 },
 * //   { mozo: 'María García', pedidos: 38, totalVentas: 57000 },
 * //   { mozo: 'Menú Público', pedidos: 20, totalVentas: 30000 },
 * //   ...
 * // ]
 */
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

/**
 * Genera reporte del estado actual del inventario.
 *
 * Lista todos los ingredientes activos con su stock, estado
 * y valor estimado basado en el costo unitario.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma con scoping
 * @param {number} tenantId - ID del tenant
 *
 * @returns {Promise<Object>} Reporte de inventario
 * @returns {Object} returns.resumen - Totales agregados
 * @returns {number} returns.resumen.totalItems - Cantidad de ingredientes
 * @returns {number} returns.resumen.itemsBajoStock - Items con stock <= mínimo
 * @returns {number} returns.resumen.valorTotalEstimado - Suma de valorEstimado de todos
 * @returns {Array} returns.ingredientes - Lista de ingredientes con estado
 *
 * @example
 * const inventario = await inventarioReporte(prisma, 1);
 * // {
 * //   resumen: { totalItems: 25, itemsBajoStock: 3, valorTotalEstimado: 45000 },
 * //   ingredientes: [
 * //     { id: 1, nombre: 'Harina', unidad: 'kg',
 * //       stockActual: 5, stockMinimo: 10, estado: 'BAJO', valorEstimado: 2500 },
 * //     { id: 2, nombre: 'Tomate', unidad: 'kg',
 * //       stockActual: 20, stockMinimo: 5, estado: 'OK', valorEstimado: 8000 },
 * //     ...
 * //   ]
 * // }
 */
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

/**
 * Genera reporte de liquidaciones y sueldos de empleados.
 *
 * Puede filtrarse por mes/año o retornar todas las liquidaciones.
 * Incluye resumen de totales pagados y pendientes.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma con scoping
 * @param {number} tenantId - ID del tenant
 * @param {Object} query - Parámetros del reporte
 * @param {number} [query.mes] - Mes (1-12)
 * @param {number} [query.anio] - Año (ej: 2024)
 *
 * @returns {Promise<Object>} Reporte de sueldos
 * @returns {Object} returns.resumen - Totales agregados
 * @returns {number} returns.resumen.totalLiquidaciones - Cantidad de liquidaciones
 * @returns {number} returns.resumen.totalPagado - Suma de liquidaciones pagadas
 * @returns {number} returns.resumen.totalPendiente - Suma de liquidaciones no pagadas
 * @returns {number} returns.resumen.horasTotales - Suma de horas trabajadas
 * @returns {Array} returns.liquidaciones - Lista de liquidaciones con empleado
 *
 * @example
 * const sueldos = await sueldosReporte(prisma, 1, { mes: 1, anio: 2024 });
 * // {
 * //   resumen: {
 * //     totalLiquidaciones: 10,
 * //     totalPagado: 450000,
 * //     totalPendiente: 50000,
 * //     horasTotales: 1600
 * //   },
 * //   liquidaciones: [
 * //     { id: 1, empleado: { nombre: 'Juan', apellido: 'Pérez', rol: 'MOZO' },
 * //       periodoDesde: '2024-01-01', periodoHasta: '2024-01-31',
 * //       horasTotales: 160, totalPagar: 50000, pagado: true },
 * //     ...
 * //   ]
 * // }
 */
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

/**
 * Obtiene ventas agrupadas por producto base con desglose de variantes.
 *
 * Similar a productosMasVendidos con agruparPorBase=true, pero siempre
 * incluye el desglose de variantes con más detalle.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma con scoping
 * @param {number} tenantId - ID del tenant
 * @param {Object} query - Parámetros del reporte
 * @param {string} [query.fechaDesde] - Fecha inicio formato YYYY-MM-DD
 * @param {string} [query.fechaHasta] - Fecha fin formato YYYY-MM-DD
 * @param {number} [query.limite=20] - Máximo de productos base a retornar
 *
 * @returns {Promise<Array>} Lista de productos base con variantes
 *
 * @example
 * const ventas = await ventasPorProductoBase(prisma, 1, { limite: 5 });
 * // [
 * //   {
 * //     productoBaseId: 1,
 * //     nombreBase: 'Pizza',
 * //     categoria: 'Pizzas',
 * //     cantidadTotal: 200,
 * //     totalVentas: 400000,
 * //     variantes: [
 * //       { nombre: 'Pizza Grande', nombreVariante: 'Grande', cantidad: 120, ventas: 280000 },
 * //       { nombre: 'Pizza Chica', nombreVariante: 'Chica', cantidad: 80, ventas: 120000 }
 * //     ]
 * //   },
 * //   ...
 * // ]
 */
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

/**
 * Calcula consumo de insumos/ingredientes por período.
 *
 * Analiza los items de pedidos COBRADOS y calcula cuánto de cada
 * ingrediente se consumió basándose en las recetas de productos.
 * Considera el multiplicadorInsumos de cada producto.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma con scoping
 * @param {number} tenantId - ID del tenant
 * @param {Object} query - Parámetros del reporte
 * @param {string} [query.fechaDesde] - Fecha inicio formato YYYY-MM-DD
 * @param {string} [query.fechaHasta] - Fecha fin formato YYYY-MM-DD
 *
 * @returns {Promise<Object>} Reporte de consumo de insumos
 * @returns {Object} returns.resumen - Totales agregados
 * @returns {number} returns.resumen.totalIngredientes - Ingredientes únicos consumidos
 * @returns {number} returns.resumen.ingredientesBajoStock - Items con stock <= mínimo
 * @returns {number} returns.resumen.costoTotalEstimado - Costo total del consumo
 * @returns {Array} returns.ingredientes - Lista de ingredientes consumidos
 *
 * @example
 * const consumo = await consumoInsumos(prisma, 1, {
 *   fechaDesde: '2024-01-01',
 *   fechaHasta: '2024-01-31'
 * });
 * // {
 * //   resumen: {
 * //     totalIngredientes: 15,
 * //     ingredientesBajoStock: 2,
 * //     costoTotalEstimado: 125000
 * //   },
 * //   ingredientes: [
 * //     {
 * //       ingredienteId: 1,
 * //       nombre: 'Harina',
 * //       unidad: 'kg',
 * //       consumoTotal: 50,
 * //       stockActual: 10,
 * //       stockMinimo: 15,
 * //       costo: 500,
 * //       costoTotal: 25000,
 * //       estado: 'BAJO',
 * //       detalleProductos: [
 * //         { producto: 'Pizza Grande', multiplicador: 1.2, cantidad: 100, consumo: 30 },
 * //         { producto: 'Pan', multiplicador: 1.0, cantidad: 50, consumo: 20 }
 * //       ]
 * //     },
 * //     ...
 * //   ]
 * // }
 */
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
