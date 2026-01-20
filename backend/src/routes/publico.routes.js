const express = require('express');
const router = express.Router();
const { prisma, getTenantPrisma } = require('../db/prisma');
const { resolveTenantFromSlug } = require('../middlewares/tenant.middleware');
const emailService = require('../services/email.service');
const eventBus = require('../services/event-bus');
const {
  isMercadoPagoConfigured,
  createPreference,
  saveTransaction
} = require('../services/mercadopago.service');

/**
 * All public routes require slug parameter for tenant resolution
 * Routes: /api/publico/:slug/...
 */

// GET /api/publico/:slug/config - Configuración pública del tenant
router.get('/:slug/config', resolveTenantFromSlug, async (req, res) => {
  try {
    const tenantPrisma = req.prisma;
    const tenant = req.tenant;
    const tenantId = req.tenantId;

    // Get tenant-specific configuration
    const configs = await tenantPrisma.configuracion.findMany();
    const configMap = {};
    configs.forEach(c => {
      configMap[c.clave] = c.valor;
    });

    // Verificar si MercadoPago está REALMENTE configurado (tiene credenciales válidas)
    const mpRealmenteConfigurado = await isMercadoPagoConfigured(tenantId);
    const mpHabilitado = configMap.mercadopago_enabled === 'true' && mpRealmenteConfigurado;

    // Verificar si efectivo está habilitado (por defecto sí)
    const efectivoHabilitado = configMap.efectivo_enabled !== 'false';

    res.json({
      tenant: {
        nombre: tenant.nombre,
        slug: tenant.slug,
        logo: tenant.logo,
        bannerUrl: tenant.bannerUrl,
        colorPrimario: tenant.colorPrimario,
        colorSecundario: tenant.colorSecundario,
        telefono: tenant.telefono,
        direccion: tenant.direccion
      },
      config: {
        tienda_abierta: configMap.tienda_abierta === 'true',
        horario_apertura: configMap.horario_apertura || '11:00',
        horario_cierre: configMap.horario_cierre || '23:00',
        costo_delivery: parseFloat(configMap.costo_delivery || '0'),
        delivery_habilitado: configMap.delivery_habilitado !== 'false',
        direccion_retiro: configMap.direccion_retiro || tenant.direccion,
        mercadopago_enabled: mpHabilitado,
        efectivo_enabled: efectivoHabilitado,
        whatsapp_numero: configMap.whatsapp_numero || null,
        nombre_negocio: configMap.nombre_negocio || tenant.nombre,
        tagline_negocio: configMap.tagline_negocio || '',
        banner_imagen: configMap.banner_imagen || tenant.bannerUrl
      }
    });
  } catch (error) {
    console.error('Error al obtener config pública:', error);
    res.status(500).json({ error: { message: 'Error al obtener configuración' } });
  }
});

// GET /api/publico/:slug/menu - Menú público (categorías con productos)
router.get('/:slug/menu', resolveTenantFromSlug, async (req, res) => {
  try {
    const tenantPrisma = req.prisma;

    const categorias = await tenantPrisma.categoria.findMany({
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
    console.error('Error al obtener menú público:', error);
    res.status(500).json({ error: { message: 'Error al obtener menú' } });
  }
});

// POST /api/publico/:slug/pedido - Crear pedido público
router.post('/:slug/pedido', resolveTenantFromSlug, async (req, res) => {
  try {
    const tenantPrisma = req.prisma;
    const tenantId = req.tenantId;

    const {
      items,
      clienteNombre,
      clienteTelefono,
      clienteDireccion,
      clienteEmail,
      tipoEntrega,
      metodoPago,
      montoAbonado,
      observaciones
    } = req.body;

    // Validaciones
    if (!items || items.length === 0) {
      return res.status(400).json({ error: { message: 'El pedido debe tener al menos un producto' } });
    }

    if (!clienteNombre || !clienteTelefono) {
      return res.status(400).json({ error: { message: 'Nombre y teléfono son requeridos' } });
    }

    if (tipoEntrega === 'DELIVERY' && !clienteDireccion) {
      return res.status(400).json({ error: { message: 'La dirección es requerida para delivery' } });
    }

    // Verificar que la tienda esté abierta
    const tiendaConfig = await tenantPrisma.configuracion.findFirst({
      where: { clave: 'tienda_abierta' }
    });
    if (tiendaConfig && tiendaConfig.valor === 'false') {
      return res.status(400).json({ error: { message: 'La tienda está cerrada en este momento' } });
    }

    // Obtener costo de delivery
    let costoEnvio = 0;
    if (tipoEntrega === 'DELIVERY') {
      const deliveryConfig = await tenantPrisma.configuracion.findFirst({
        where: { clave: 'costo_delivery' }
      });
      costoEnvio = deliveryConfig ? parseFloat(deliveryConfig.valor) : 0;
    }

    // Obtener productos y calcular totales (desde la DB, no del frontend)
    const productoIds = items.map(item => item.productoId);
    const productos = await tenantPrisma.producto.findMany({
      where: {
        id: { in: productoIds },
        disponible: true
      }
    });

    // Verificar disponibilidad
    if (productos.length !== productoIds.length) {
      return res.status(400).json({ error: { message: 'Algunos productos no están disponibles' } });
    }

    // Calcular subtotal
    let subtotal = 0;
    const itemsData = items.map(item => {
      const producto = productos.find(p => p.id === item.productoId);
      const cantidad = parseInt(item.cantidad);
      const precioUnitario = parseFloat(producto.precio);
      const itemSubtotal = precioUnitario * cantidad;
      subtotal += itemSubtotal;

      return {
        tenantId,
        productoId: producto.id,
        cantidad,
        precioUnitario,
        subtotal: itemSubtotal,
        observaciones: item.observaciones || null
      };
    });

    const total = subtotal + costoEnvio;

    // Crear pedido con tenantId
    const pedido = await prisma.pedido.create({
      data: {
        tenantId,
        tipo: tipoEntrega === 'DELIVERY' ? 'DELIVERY' : 'MOSTRADOR',
        tipoEntrega,
        clienteNombre,
        clienteTelefono,
        clienteDireccion: tipoEntrega === 'DELIVERY' ? clienteDireccion : null,
        clienteEmail,
        costoEnvio,
        subtotal,
        total,
        observaciones,
        origen: 'MENU_PUBLICO',
        estadoPago: 'PENDIENTE',
        items: {
          create: itemsData
        }
      },
      include: {
        items: {
          include: { producto: true }
        }
      }
    });

    // Publish event with tenantId
    eventBus.publish('pedido.updated', {
      tenantId,
      id: pedido.id,
      estado: pedido.estado,
      tipo: pedido.tipo,
      mesaId: pedido.mesaId || null,
      updatedAt: pedido.updatedAt || new Date().toISOString()
    });

    // Si pago en efectivo, crear registro de pago
    if (metodoPago === 'EFECTIVO' && montoAbonado) {
      const vuelto = parseFloat(montoAbonado) - total;
      await prisma.pago.create({
        data: {
          tenantId,
          pedidoId: pedido.id,
          monto: total,
          metodo: 'EFECTIVO',
          estado: 'PENDIENTE',
          montoAbonado: parseFloat(montoAbonado),
          vuelto: vuelto > 0 ? vuelto : 0
        }
      });
    }

    // Enviar email de confirmación
    if (pedido.clienteEmail) {
      try {
        await emailService.sendOrderConfirmation(pedido, req.tenant);
        console.log('Email de confirmación enviado a:', pedido.clienteEmail);
      } catch (emailError) {
        console.error('Error al enviar email de confirmación:', emailError);
        // No fallar el pedido por error de email
      }
    }

    res.status(201).json({
      pedido,
      costoEnvio,
      total,
      message: 'Pedido creado correctamente'
    });
  } catch (error) {
    console.error('Error al crear pedido público:', error);
    res.status(500).json({ error: { message: 'Error al crear el pedido' } });
  }
});

// POST /api/publico/:slug/pedido/:id/pagar - Iniciar pago MercadoPago
router.post('/:slug/pedido/:id/pagar', resolveTenantFromSlug, async (req, res) => {
  try {
    const tenantPrisma = req.prisma;
    const tenantId = req.tenantId;
    const { id } = req.params;
    const pedidoId = parseInt(id);

    const pedido = await tenantPrisma.pedido.findFirst({
      where: { id: pedidoId },
      include: {
        items: { include: { producto: true } }
      }
    });

    if (!pedido) {
      return res.status(404).json({ error: { message: 'Pedido no encontrado' } });
    }

    if (pedido.estadoPago === 'APROBADO') {
      return res.status(400).json({ error: { message: 'El pedido ya está pagado' } });
    }

    // Verificar si MercadoPago está REALMENTE configurado para este tenant
    const mpConfigurado = await isMercadoPagoConfigured(tenantId);
    if (!mpConfigurado) {
      return res.status(400).json({
        error: { message: 'MercadoPago no está configurado para este negocio. Solo se acepta pago en efectivo.' }
      });
    }

    // Crear items para MP
    const mpItems = pedido.items.map(item => ({
      id: item.productoId.toString(),
      title: item.producto.nombre,
      quantity: item.cantidad,
      unit_price: parseFloat(item.precioUnitario),
      currency_id: 'ARS'
    }));

    // Agregar costo de envío como item si aplica
    if (parseFloat(pedido.costoEnvio) > 0) {
      mpItems.push({
        id: 'envio',
        title: 'Costo de envío',
        quantity: 1,
        unit_price: parseFloat(pedido.costoEnvio),
        currency_id: 'ARS'
      });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const slug = req.tenantSlug;

    const preferenceData = {
      items: mpItems,
      back_urls: {
        success: `${frontendUrl}/menu/${slug}?pago=exito&pedido=${pedidoId}`,
        failure: `${frontendUrl}/menu/${slug}?pago=error&pedido=${pedidoId}`,
        pending: `${frontendUrl}/menu/${slug}?pago=pendiente&pedido=${pedidoId}`
      },
      auto_return: 'approved',
      external_reference: `${tenantId}-${pedidoId}`,
      notification_url: `${backendUrl}/api/pagos/webhook/mercadopago`,
      statement_descriptor: req.tenant.nombre.substring(0, 22).toUpperCase()
    };

    // Usar el servicio multi-tenant para crear la preferencia
    const response = await createPreference(tenantId, preferenceData);

    // Crear registro de pago pendiente
    const idempotencyKey = `mp-${tenantId}-${pedidoId}-${Date.now()}`;
    await prisma.pago.create({
      data: {
        tenantId,
        pedidoId,
        monto: parseFloat(pedido.total),
        metodo: 'MERCADOPAGO',
        estado: 'PENDIENTE',
        mpPreferenceId: response.id,
        idempotencyKey
      }
    });

    res.json({
      preferenceId: response.id,
      initPoint: response.init_point,
      sandboxInitPoint: response.sandbox_init_point
    });
  } catch (error) {
    console.error('Error al crear preferencia de pago:', error);

    // Mensaje de error más descriptivo
    if (error.message?.includes('no está configurado')) {
      return res.status(400).json({ error: { message: error.message } });
    }

    res.status(500).json({ error: { message: 'Error al iniciar el pago' } });
  }
});

// GET /api/publico/:slug/pedido/:id - Obtener estado de pedido
router.get('/:slug/pedido/:id', resolveTenantFromSlug, async (req, res) => {
  try {
    const tenantPrisma = req.prisma;
    const { id } = req.params;

    const pedido = await tenantPrisma.pedido.findFirst({
      where: { id: parseInt(id) },
      include: {
        items: { include: { producto: true } },
        pagos: true
      }
    });

    if (!pedido) {
      return res.status(404).json({ error: { message: 'Pedido no encontrado' } });
    }

    res.json(pedido);
  } catch (error) {
    console.error('Error al obtener pedido:', error);
    res.status(500).json({ error: { message: 'Error al obtener pedido' } });
  }
});

// ============================================
// BACKWARDS COMPATIBILITY ROUTES
// These redirect to the default tenant during migration
// ============================================

// GET /api/publico/config - Redirect to default tenant
router.get('/config', async (req, res) => {
  console.warn('[DEPRECATION] /api/publico/config is deprecated. Use /api/publico/:slug/config');
  res.redirect(301, '/api/publico/default/config');
});

// GET /api/publico/menu - Redirect to default tenant
router.get('/menu', async (req, res) => {
  console.warn('[DEPRECATION] /api/publico/menu is deprecated. Use /api/publico/:slug/menu');
  res.redirect(301, '/api/publico/default/menu');
});

module.exports = router;
