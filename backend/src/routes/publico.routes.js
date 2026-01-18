const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const configuracionController = require('../controllers/configuracion.controller');
const emailService = require('../services/email.service');

// GET /api/publico/config - Configuración pública
router.get('/config', configuracionController.obtenerPublica);

// GET /api/publico/menu - Menú público (categorías con productos)
router.get('/menu', async (req, res) => {
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
    console.error('Error al obtener menú público:', error);
    res.status(500).json({ error: { message: 'Error al obtener menú' } });
  }
});

// POST /api/publico/pedido - Crear pedido público
router.post('/pedido', async (req, res) => {
  try {
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
    const tiendaConfig = await prisma.configuracion.findUnique({ where: { clave: 'tienda_abierta' } });
    if (tiendaConfig && tiendaConfig.valor === 'false') {
      return res.status(400).json({ error: { message: 'La tienda está cerrada en este momento' } });
    }

    // Obtener costo de delivery
    let costoEnvio = 0;
    if (tipoEntrega === 'DELIVERY') {
      const deliveryConfig = await prisma.configuracion.findUnique({ where: { clave: 'costo_delivery' } });
      costoEnvio = deliveryConfig ? parseFloat(deliveryConfig.valor) : 0;
    }

    // Obtener productos y calcular totales (desde la DB, no del frontend)
    const productoIds = items.map(item => item.productoId);
    const productos = await prisma.producto.findMany({
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
        productoId: producto.id,
        cantidad,
        precioUnitario,
        subtotal: itemSubtotal,
        observaciones: item.observaciones || null
      };
    });

    const total = subtotal + costoEnvio;

    // Crear pedido
    const pedido = await prisma.pedido.create({
      data: {
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

    // Si pago en efectivo, crear registro de pago
    if (metodoPago === 'EFECTIVO' && montoAbonado) {
      const vuelto = parseFloat(montoAbonado) - total;
      await prisma.pago.create({
        data: {
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
        await emailService.sendOrderConfirmation(pedido);
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

// POST /api/publico/pedido/:id/pagar - Iniciar pago MercadoPago
router.post('/pedido/:id/pagar', async (req, res) => {
  try {
    const { id } = req.params;
    const pedidoId = parseInt(id);

    const pedido = await prisma.pedido.findUnique({
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

    // Verificar si MercadoPago está habilitado
    const mpConfig = await prisma.configuracion.findUnique({ where: { clave: 'mercadopago_enabled' } });
    if (!mpConfig || mpConfig.valor !== 'true') {
      return res.status(400).json({ error: { message: 'MercadoPago no está habilitado' } });
    }

    // Importar MercadoPago
    const { MercadoPagoConfig, Preference } = require('mercadopago');

    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
    });

    const preference = new Preference(client);

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

    const preferenceData = {
      items: mpItems,
      back_urls: {
        success: `${frontendUrl}/menu?pago=exito&pedido=${pedidoId}`,
        failure: `${frontendUrl}/menu?pago=error&pedido=${pedidoId}`,
        pending: `${frontendUrl}/menu?pago=pendiente&pedido=${pedidoId}`
      },
      auto_return: 'approved',
      external_reference: pedidoId.toString(),
      notification_url: `${backendUrl}/api/pagos/webhook/mercadopago`,
      statement_descriptor: 'GESTIONEO'
    };

    const response = await preference.create({ body: preferenceData });

    // Crear registro de pago pendiente
    const idempotencyKey = `mp-${pedidoId}-${Date.now()}`;
    await prisma.pago.create({
      data: {
        pedidoId,
        monto: parseFloat(pedido.total) + parseFloat(pedido.costoEnvio),
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
    res.status(500).json({ error: { message: 'Error al iniciar el pago' } });
  }
});

// GET /api/publico/pedido/:id - Obtener estado de pedido
router.get('/pedido/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const pedido = await prisma.pedido.findUnique({
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

module.exports = router;
