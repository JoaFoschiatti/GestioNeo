/**
 * Servicio para el menú público (accesible sin autenticación).
 *
 * Este servicio maneja las operaciones del menú QR que los clientes
 * escanean para ver productos y hacer pedidos desde sus dispositivos.
 *
 * IMPORTANTE: Este servicio NO requiere autenticación JWT.
 * El tenant se resuelve por el slug en la URL (/menu/:slug).
 *
 * Funcionalidades:
 * - Obtener configuración pública del restaurante
 * - Listar menú con categorías y productos disponibles
 * - Crear pedidos desde el menú (delivery o retiro)
 * - Integración con MercadoPago para pagos online
 * - Verificar estado de pago de pedidos
 *
 * @module publico.service
 */

const { createHttpError } = require('../utils/http-error');
const {
  isMercadoPagoConfigured,
  createPreference,
  saveTransaction,
  searchPaymentByReference
} = require('./mercadopago.service');

/**
 * Convierte array de configuraciones a objeto map.
 * @private
 */
const buildConfigMap = (configs) => {
  const configMap = {};
  configs.forEach(c => {
    configMap[c.clave] = c.valor;
  });
  return configMap;
};

/**
 * Obtiene la configuración pública del restaurante.
 *
 * Retorna solo datos seguros para mostrar públicamente (sin tokens ni credenciales).
 * Verifica si MercadoPago está realmente configurado antes de habilitarlo.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma con scoping
 * @param {number} tenantId - ID del tenant
 * @param {Object} tenant - Objeto tenant con datos básicos
 *
 * @returns {Promise<Object>} Configuración pública
 * @returns {Object} returns.tenant - Datos del restaurante (nombre, logo, colores)
 * @returns {Object} returns.config - Configuración operativa
 * @returns {boolean} returns.config.tienda_abierta - Si está abierta
 * @returns {string} returns.config.horario_apertura - Hora de apertura
 * @returns {string} returns.config.horario_cierre - Hora de cierre
 * @returns {number} returns.config.costo_delivery - Costo de envío
 * @returns {boolean} returns.config.delivery_habilitado - Si hay delivery
 * @returns {boolean} returns.config.mercadopago_enabled - Si MP está habilitado
 * @returns {boolean} returns.config.efectivo_enabled - Si acepta efectivo
 */
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

/**
 * Obtiene el menú público con categorías y productos disponibles.
 *
 * Solo retorna categorías activas con productos disponibles.
 * Incluye variantes de productos ordenadas.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma
 *
 * @returns {Promise<Array>} Categorías con productos
 */
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

/**
 * Construye los datos para crear una preferencia de MercadoPago.
 *
 * Genera URLs de retorno, configura los items del pago y
 * establece la referencia externa para el webhook.
 *
 * @private
 * @param {Object} params - Parámetros
 * @param {number} params.tenantId - ID del tenant
 * @param {number} params.pedidoId - ID del pedido
 * @param {string} params.tenantSlug - Slug del restaurante
 * @param {string} params.tenantNombre - Nombre para el descriptor de pago
 * @param {Array} params.items - Items del pedido
 * @param {number} params.costoEnvio - Costo de envío
 *
 * @returns {Object} Datos para MercadoPago createPreference
 */
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

/**
 * Crea un pedido desde el menú público.
 *
 * A diferencia de crearPedido del servicio de pedidos, este:
 * - NO requiere usuarioId (es anónimo)
 * - Incluye datos del cliente (nombre, teléfono, dirección)
 * - Valida configuración de tienda (abierta, delivery habilitado)
 * - Puede crear preferencia de MercadoPago automáticamente
 * - Calcula costo de envío si es delivery
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma
 * @param {Object} params - Parámetros
 * @param {number} params.tenantId - ID del tenant
 * @param {string} params.tenantSlug - Slug del restaurante
 * @param {Object} params.tenant - Objeto tenant
 * @param {Object} params.body - Datos del pedido
 * @param {Array<Object>} params.body.items - Items del pedido
 * @param {string} params.body.clienteNombre - Nombre del cliente
 * @param {string} params.body.clienteTelefono - Teléfono
 * @param {string} [params.body.clienteDireccion] - Dirección (requerido para delivery)
 * @param {string} [params.body.clienteEmail] - Email para notificaciones
 * @param {('DELIVERY'|'RETIRO')} params.body.tipoEntrega - Tipo de entrega
 * @param {('EFECTIVO'|'MERCADOPAGO')} params.body.metodoPago - Método de pago
 * @param {number} [params.body.montoAbonado] - Monto con el que paga (efectivo)
 * @param {string} [params.body.observaciones] - Observaciones del pedido
 *
 * @returns {Promise<Object>} Resultado de la creación
 * @returns {Object} returns.pedido - Pedido creado
 * @returns {number} returns.costoEnvio - Costo de envío aplicado
 * @returns {number} returns.total - Total del pedido
 * @returns {string|null} returns.initPoint - URL de MercadoPago (si aplica)
 * @returns {boolean} returns.shouldSendEmail - Si debe enviarse email
 * @returns {Array} returns.events - Eventos SSE a emitir
 *
 * @throws {HttpError} 400 - Validaciones: items vacíos, datos faltantes, tienda cerrada, etc.
 * @throws {HttpError} 500 - Error al conectar con MercadoPago
 */
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
      tipo: 'ONLINE',
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
      logger.error('Error al crear preferencia MP, eliminando pedido', { error: mpError, pedidoId: pedido.id });
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

/**
 * Inicia el pago con MercadoPago para un pedido existente.
 *
 * Útil cuando el cliente creó el pedido con efectivo pero quiere
 * cambiar a MercadoPago, o cuando necesita reintentar el pago.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma
 * @param {Object} params - Parámetros
 * @param {number} params.tenantId - ID del tenant
 * @param {string} params.tenantSlug - Slug del restaurante
 * @param {Object} params.tenant - Objeto tenant
 * @param {number} params.pedidoId - ID del pedido
 *
 * @returns {Promise<Object>} Datos de la preferencia creada
 * @returns {string} returns.preferenceId - ID de la preferencia MP
 * @returns {string} returns.initPoint - URL de pago producción
 * @returns {string} returns.sandboxInitPoint - URL de pago sandbox
 *
 * @throws {HttpError} 404 - Pedido no encontrado
 * @throws {HttpError} 400 - Pedido ya pagado o MercadoPago no configurado
 */
const startMercadoPagoPaymentForOrder = async (prisma, { tenantId, tenantSlug, tenant, pedidoId }) => {
  const pedido = await prisma.pedido.findFirst({
    where: {
      id: pedidoId,
      tenantId: tenantId
    },
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

/**
 * Obtiene el estado de un pedido público con verificación de pago.
 *
 * Si el pedido tiene un pago pendiente de MercadoPago, consulta
 * la API de MP para verificar si ya fue aprobado (útil cuando
 * el webhook no llegó o el cliente volvió antes de la confirmación).
 *
 * @param {import('@prisma/client').PrismaClient} prisma - Cliente Prisma
 * @param {Object} params - Parámetros
 * @param {number} params.tenantId - ID del tenant
 * @param {number} params.pedidoId - ID del pedido
 *
 * @returns {Promise<Object>} Estado del pedido
 * @returns {Object} returns.pedido - Pedido con items y pagos
 * @returns {Array} returns.events - Eventos SSE a emitir si hubo cambio
 *
 * @throws {HttpError} 404 - Pedido no encontrado
 */
const getPublicOrderStatus = async (prisma, { tenantId, pedidoId }) => {
  let pedido = await prisma.pedido.findFirst({
    where: {
      id: pedidoId,
      tenantId: tenantId
    },
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
