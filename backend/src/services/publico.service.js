const { createHttpError } = require('../utils/http-error');
const {
  isMercadoPagoConfigured,
  createPreference,
  saveTransaction,
  searchPaymentByReference
} = require('./mercadopago.service');

const buildConfigMap = (configs) => {
  const configMap = {};
  configs.forEach(c => {
    configMap[c.clave] = c.valor;
  });
  return configMap;
};

const getPublicConfig = async (prisma, tenantId, tenant) => {
  const configs = await prisma.configuracion.findMany();
  const configMap = buildConfigMap(configs);

  const mpRealmenteConfigurado = await isMercadoPagoConfigured(tenantId);
  const mpHabilitado = configMap.mercadopago_enabled === 'true' && mpRealmenteConfigurado;

  const efectivoHabilitado = configMap.efectivo_enabled !== 'false';

  return {
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
      tienda_abierta: configMap.tienda_abierta !== 'false',
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
  };
};

const getPublicMenu = async (prisma) => {
  return prisma.categoria.findMany({
    where: { activa: true },
    orderBy: { orden: 'asc' },
    include: {
      productos: {
        where: {
          disponible: true,
          productoBaseId: null
        },
        orderBy: { nombre: 'asc' },
        include: {
          variantes: {
            where: { disponible: true },
            orderBy: { ordenVariante: 'asc' },
            select: {
              id: true,
              nombre: true,
              nombreVariante: true,
              precio: true,
              descripcion: true,
              imagen: true,
              multiplicadorInsumos: true,
              ordenVariante: true,
              esVariantePredeterminada: true
            }
          }
        }
      }
    }
  });
};

const buildPreferenceData = ({ tenantId, pedidoId, tenantSlug, tenantNombre, items, costoEnvio }) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  const isLocalhost = frontendUrl.includes('localhost') || frontendUrl.includes('127.0.0.1');

  const mpItems = items.map(item => ({
    id: item.productoId.toString(),
    title: item.producto.nombre,
    quantity: item.cantidad,
    unit_price: parseFloat(item.precioUnitario),
    currency_id: 'ARS'
  }));

  if (costoEnvio > 0) {
    mpItems.push({
      id: 'envio',
      title: 'Costo de envío',
      quantity: 1,
      unit_price: costoEnvio,
      currency_id: 'ARS'
    });
  }

  const preferenceData = {
    items: mpItems,
    back_urls: {
      success: `${frontendUrl}/menu/${tenantSlug}?pago=exito&pedido=${pedidoId}`,
      failure: `${frontendUrl}/menu/${tenantSlug}?pago=error&pedido=${pedidoId}`,
      pending: `${frontendUrl}/menu/${tenantSlug}?pago=pendiente&pedido=${pedidoId}`
    },
    external_reference: `${tenantId}-${pedidoId}`,
    notification_url: `${backendUrl}/api/pagos/webhook/mercadopago`,
    statement_descriptor: tenantNombre.substring(0, 22).toUpperCase()
  };

  if (!isLocalhost) {
    preferenceData.auto_return = 'approved';
  }

  return preferenceData;
};

const createPublicOrder = async (prisma, { tenantId, tenantSlug, tenant, body }) => {
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
  } = body;

  const configs = await prisma.configuracion.findMany({
    where: {
      clave: {
        in: ['tienda_abierta', 'delivery_habilitado', 'costo_delivery', 'efectivo_enabled', 'mercadopago_enabled']
      }
    }
  });
  const configMap = buildConfigMap(configs);
  const tiendaAbierta = configMap.tienda_abierta !== 'false';
  const deliveryHabilitado = configMap.delivery_habilitado !== 'false';
  const efectivoHabilitado = configMap.efectivo_enabled !== 'false';
  const mercadopagoHabilitado = configMap.mercadopago_enabled === 'true';

  if (!Array.isArray(items) || items.length === 0) {
    throw createHttpError.badRequest('El pedido debe tener al menos un producto');
  }

  if (!clienteNombre || !clienteTelefono) {
    throw createHttpError.badRequest('Nombre y teléfono son requeridos');
  }

  if (tipoEntrega === 'DELIVERY' && !clienteDireccion) {
    throw createHttpError.badRequest('La dirección es requerida para delivery');
  }

  if (!tiendaAbierta) {
    throw createHttpError.badRequest('La tienda está cerrada en este momento');
  }

  if (tipoEntrega === 'DELIVERY' && !deliveryHabilitado) {
    throw createHttpError.badRequest('El delivery no está disponible en este momento');
  }

  if (metodoPago === 'EFECTIVO' && !efectivoHabilitado) {
    throw createHttpError.badRequest('El pago en efectivo no está disponible en este momento');
  }

  if (metodoPago === 'MERCADOPAGO') {
    if (!mercadopagoHabilitado) {
      throw createHttpError.badRequest('MercadoPago no está disponible en este momento');
    }
    const mpConfigurado = await isMercadoPagoConfigured(tenantId);
    if (!mpConfigurado) {
      throw createHttpError.badRequest(
        'MercadoPago no está configurado para este negocio. Solo se acepta pago en efectivo.'
      );
    }
  }

  let costoEnvio = 0;
  if (tipoEntrega === 'DELIVERY') {
    costoEnvio = configMap.costo_delivery ? parseFloat(configMap.costo_delivery) : 0;
  }

  const productoIds = items.map(item => item.productoId);
  const productoIdsUnicos = Array.from(new Set(productoIds));
  const productos = await prisma.producto.findMany({
    where: {
      id: { in: productoIdsUnicos },
      disponible: true
    }
  });

  if (productos.length !== productoIdsUnicos.length) {
    throw createHttpError.badRequest('Algunos productos no están disponibles');
  }

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

  let initPoint = null;

  if (metodoPago === 'MERCADOPAGO') {
    try {
      const preferenceData = buildPreferenceData({
        tenantId,
        pedidoId: pedido.id,
        tenantSlug,
        tenantNombre: tenant.nombre,
        items: pedido.items,
        costoEnvio
      });

      const mpResponse = await createPreference(tenantId, preferenceData);

      const idempotencyKey = `mp-${tenantId}-${pedido.id}-${Date.now()}`;
      await prisma.pago.create({
        data: {
          tenantId,
          pedidoId: pedido.id,
          monto: total,
          metodo: 'MERCADOPAGO',
          estado: 'PENDIENTE',
          mpPreferenceId: mpResponse.id,
          idempotencyKey
        }
      });

      initPoint = mpResponse.init_point;
    } catch (mpError) {
      console.error('Error al crear preferencia MP, eliminando pedido:', mpError);
      await prisma.pedidoItem.deleteMany({ where: { pedidoId: pedido.id } });
      await prisma.pedido.delete({ where: { id: pedido.id } });

      throw createHttpError.internal('Error al conectar con MercadoPago. Por favor intenta de nuevo.');
    }
  }

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

  const shouldSendEmail = Boolean(pedido.clienteEmail && metodoPago !== 'MERCADOPAGO');

  const events = [
    {
      topic: 'pedido.updated',
      payload: {
        tenantId,
        id: pedido.id,
        estado: pedido.estado,
        tipo: pedido.tipo,
        mesaId: pedido.mesaId || null,
        updatedAt: pedido.updatedAt || new Date().toISOString()
      }
    }
  ];

  return {
    pedido,
    costoEnvio,
    total,
    initPoint,
    shouldSendEmail,
    events
  };
};

const startMercadoPagoPaymentForOrder = async (prisma, { tenantId, tenantSlug, tenant, pedidoId }) => {
  const pedido = await prisma.pedido.findFirst({
    where: { id: pedidoId },
    include: {
      items: { include: { producto: true } }
    }
  });

  if (!pedido) {
    throw createHttpError.notFound('Pedido no encontrado');
  }

  if (pedido.estadoPago === 'APROBADO') {
    throw createHttpError.badRequest('El pedido ya está pagado');
  }

  const config = await prisma.configuracion.findFirst({
    where: { clave: 'mercadopago_enabled' }
  });
  if (config?.valor !== 'true') {
    throw createHttpError.badRequest('MercadoPago no está disponible en este momento');
  }

  const mpConfigurado = await isMercadoPagoConfigured(tenantId);
  if (!mpConfigurado) {
    throw createHttpError.badRequest(
      'MercadoPago no está configurado para este negocio. Solo se acepta pago en efectivo.'
    );
  }

  const preferenceData = buildPreferenceData({
    tenantId,
    pedidoId,
    tenantSlug,
    tenantNombre: tenant.nombre,
    items: pedido.items,
    costoEnvio: parseFloat(pedido.costoEnvio)
  });

  let response;
  try {
    response = await createPreference(tenantId, preferenceData);
  } catch (error) {
    if (error.message?.includes('no está configurado')) {
      throw createHttpError.badRequest(error.message);
    }
    throw error;
  }

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

  return {
    preferenceId: response.id,
    initPoint: response.init_point,
    sandboxInitPoint: response.sandbox_init_point
  };
};

const getPublicOrderStatus = async (prisma, { tenantId, pedidoId }) => {
  let pedido = await prisma.pedido.findFirst({
    where: { id: pedidoId },
    include: {
      items: { include: { producto: true } },
      pagos: true
    }
  });

  if (!pedido) {
    throw createHttpError.notFound('Pedido no encontrado');
  }

  const events = [];

  if (pedido.estadoPago === 'PENDIENTE') {
    const pagoMP = pedido.pagos.find(p => p.metodo === 'MERCADOPAGO' && p.estado === 'PENDIENTE');

    if (pagoMP) {
      const externalReference = `${tenantId}-${pedidoId}`;
      const pagoAprobado = await searchPaymentByReference(tenantId, externalReference);

      if (pagoAprobado) {
        await prisma.pago.update({
          where: { id: pagoMP.id },
          data: {
            estado: 'APROBADO',
            mpPaymentId: pagoAprobado.id.toString()
          }
        });

        await prisma.pedido.update({
          where: { id: pedidoId },
          data: { estadoPago: 'APROBADO' }
        });

        await saveTransaction(tenantId, pagoAprobado, pagoMP.id);

        events.push({
          topic: 'pedido.updated',
          payload: {
            tenantId,
            id: pedidoId,
            estado: pedido.estado,
            estadoPago: 'APROBADO',
            tipo: pedido.tipo,
            mesaId: pedido.mesaId || null,
            updatedAt: new Date().toISOString()
          }
        });

        pedido = {
          ...pedido,
          estadoPago: 'APROBADO',
          pagos: pedido.pagos.map(p =>
            p.id === pagoMP.id
              ? { ...p, estado: 'APROBADO', mpPaymentId: pagoAprobado.id.toString() }
              : p
          )
        };
      }
    }
  }

  return { pedido, events };
};

module.exports = {
  getPublicConfig,
  getPublicMenu,
  createPublicOrder,
  startMercadoPagoPaymentForOrder,
  getPublicOrderStatus
};
