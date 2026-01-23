const { createHttpError } = require('../utils/http-error');

const listarTenants = async (prisma, query) => {
  const { page, limit, search, activo } = query;
  const skip = (page - 1) * limit;

  const where = {};
  if (search) {
    where.OR = [
      { nombre: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } }
    ];
  }
  if (activo !== undefined) {
    where.activo = activo;
  }

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            usuarios: true,
            pedidos: true,
            productos: true
          }
        }
      }
    }),
    prisma.tenant.count({ where })
  ]);

  return {
    tenants,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

const obtenerTenant = async (prisma, id) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          usuarios: true,
          empleados: true,
          pedidos: true,
          productos: true,
          categorias: true,
          mesas: true
        }
      }
    }
  });

  if (!tenant) {
    throw createHttpError.notFound('Restaurante no encontrado');
  }

  return tenant;
};

const toggleActivo = async (prisma, id, activo) => {
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) {
    throw createHttpError.notFound('Restaurante no encontrado');
  }

  const actualizado = await prisma.tenant.update({
    where: { id },
    data: { activo }
  });

  return {
    message: activo ? 'Restaurante activado' : 'Restaurante desactivado',
    tenant: actualizado
  };
};

const obtenerMetricas = async (prisma, id) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id }
  });

  if (!tenant) {
    throw createHttpError.notFound('Restaurante no encontrado');
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const inicioSemana = new Date(hoy);
  inicioSemana.setDate(hoy.getDate() - hoy.getDay());

  const [
    pedidosHoy,
    pedidosSemana,
    pedidosMes,
    ventasHoy,
    ventasMes,
    usuariosActivos,
    productosActivos
  ] = await Promise.all([
    prisma.pedido.count({
      where: {
        tenantId: id,
        createdAt: { gte: hoy }
      }
    }),
    prisma.pedido.count({
      where: {
        tenantId: id,
        createdAt: { gte: inicioSemana }
      }
    }),
    prisma.pedido.count({
      where: {
        tenantId: id,
        createdAt: { gte: inicioMes }
      }
    }),
    prisma.pedido.aggregate({
      where: {
        tenantId: id,
        estadoPago: 'APROBADO',
        createdAt: { gte: hoy }
      },
      _sum: { total: true }
    }),
    prisma.pedido.aggregate({
      where: {
        tenantId: id,
        estadoPago: 'APROBADO',
        createdAt: { gte: inicioMes }
      },
      _sum: { total: true }
    }),
    prisma.usuario.count({
      where: { tenantId: id, activo: true }
    }),
    prisma.producto.count({
      where: { tenantId: id, disponible: true }
    })
  ]);

  return {
    tenant: {
      id: tenant.id,
      nombre: tenant.nombre,
      slug: tenant.slug,
      plan: tenant.plan,
      activo: tenant.activo
    },
    metricas: {
      pedidos: {
        hoy: pedidosHoy,
        semana: pedidosSemana,
        mes: pedidosMes
      },
      ventas: {
        hoy: ventasHoy._sum.total || 0,
        mes: ventasMes._sum.total || 0
      },
      usuarios: usuariosActivos,
      productos: productosActivos
    }
  };
};

const obtenerMetricasGlobales = async (prisma) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  const [
    totalTenants,
    tenantsActivos,
    totalPedidosHoy,
    totalPedidosMes,
    ventasHoy,
    ventasMes
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { activo: true } }),
    prisma.pedido.count({ where: { createdAt: { gte: hoy } } }),
    prisma.pedido.count({ where: { createdAt: { gte: inicioMes } } }),
    prisma.pedido.aggregate({
      where: { estadoPago: 'APROBADO', createdAt: { gte: hoy } },
      _sum: { total: true }
    }),
    prisma.pedido.aggregate({
      where: { estadoPago: 'APROBADO', createdAt: { gte: inicioMes } },
      _sum: { total: true }
    })
  ]);

  return {
    tenants: {
      total: totalTenants,
      activos: tenantsActivos
    },
    pedidos: {
      hoy: totalPedidosHoy,
      mes: totalPedidosMes
    },
    ventas: {
      hoy: ventasHoy._sum.total || 0,
      mes: ventasMes._sum.total || 0
    }
  };
};

module.exports = {
  listarTenants,
  obtenerTenant,
  toggleActivo,
  obtenerMetricas,
  obtenerMetricasGlobales
};

