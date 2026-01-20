/**
 * Super Admin Controller
 *
 * Provides administrative functions across all tenants:
 * - List all tenants
 * - Activate/deactivate tenants
 * - View metrics per tenant
 */

const { prisma } = require('../db/prisma');

/**
 * List all tenants with basic stats
 */
const listarTenants = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, activo } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const where = {};
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (activo !== undefined) {
      where.activo = activo === 'true';
    }

    // Get tenants with counts
    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        skip,
        take: parseInt(limit),
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

    res.json({
      tenants,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error listando tenants:', error);
    res.status(500).json({ error: { message: 'Error al listar restaurantes' } });
  }
};

/**
 * Get tenant details
 */
const obtenerTenant = async (req, res) => {
  try {
    const { id } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { id: parseInt(id) },
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
      return res.status(404).json({ error: { message: 'Restaurante no encontrado' } });
    }

    res.json(tenant);
  } catch (error) {
    console.error('Error obteniendo tenant:', error);
    res.status(500).json({ error: { message: 'Error al obtener restaurante' } });
  }
};

/**
 * Toggle tenant active status
 */
const toggleActivo = async (req, res) => {
  try {
    const { id } = req.params;
    const { activo } = req.body;

    const tenant = await prisma.tenant.update({
      where: { id: parseInt(id) },
      data: { activo }
    });

    res.json({
      message: activo ? 'Restaurante activado' : 'Restaurante desactivado',
      tenant
    });
  } catch (error) {
    console.error('Error actualizando tenant:', error);
    res.status(500).json({ error: { message: 'Error al actualizar estado' } });
  }
};

/**
 * Get metrics for a tenant
 */
const obtenerMetricas = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = parseInt(id);

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return res.status(404).json({ error: { message: 'Restaurante no encontrado' } });
    }

    // Get date ranges
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay());

    // Get metrics
    const [
      pedidosHoy,
      pedidosSemana,
      pedidosMes,
      ventasHoy,
      ventasMes,
      usuariosActivos,
      productosActivos
    ] = await Promise.all([
      // Pedidos hoy
      prisma.pedido.count({
        where: {
          tenantId,
          createdAt: { gte: hoy }
        }
      }),
      // Pedidos semana
      prisma.pedido.count({
        where: {
          tenantId,
          createdAt: { gte: inicioSemana }
        }
      }),
      // Pedidos mes
      prisma.pedido.count({
        where: {
          tenantId,
          createdAt: { gte: inicioMes }
        }
      }),
      // Ventas hoy
      prisma.pedido.aggregate({
        where: {
          tenantId,
          estadoPago: 'APROBADO',
          createdAt: { gte: hoy }
        },
        _sum: { total: true }
      }),
      // Ventas mes
      prisma.pedido.aggregate({
        where: {
          tenantId,
          estadoPago: 'APROBADO',
          createdAt: { gte: inicioMes }
        },
        _sum: { total: true }
      }),
      // Usuarios activos
      prisma.usuario.count({
        where: { tenantId, activo: true }
      }),
      // Productos activos
      prisma.producto.count({
        where: { tenantId, disponible: true }
      })
    ]);

    res.json({
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
    });
  } catch (error) {
    console.error('Error obteniendo métricas:', error);
    res.status(500).json({ error: { message: 'Error al obtener métricas' } });
  }
};

/**
 * Get global platform metrics
 */
const obtenerMetricasGlobales = async (req, res) => {
  try {
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

    res.json({
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
    });
  } catch (error) {
    console.error('Error obteniendo métricas globales:', error);
    res.status(500).json({ error: { message: 'Error al obtener métricas' } });
  }
};

module.exports = {
  listarTenants,
  obtenerTenant,
  toggleActivo,
  obtenerMetricas,
  obtenerMetricasGlobales
};
