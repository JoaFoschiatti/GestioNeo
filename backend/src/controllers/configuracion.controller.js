const { prisma: basePrisma } = require('../db/prisma');
const configuracionService = require('../services/configuracion.service');
const { createHttpError } = require('../utils/http-error');
const { getPrisma } = require('../utils/get-prisma');

// Obtener configuración pública (sin auth) - DEPRECATED, usar /api/publico/:slug/config
const obtenerPublica = async (req, res) => {
  // Para backwards compatibility, usar tenant por defecto
  const prisma = getPrisma(req);
  const tenantId = req.tenantId || 1;

  const configs = await prisma.configuracion.findMany({
    where: { tenantId }
  });

  // Convertir a objeto
  const configObj = {};
  configs.forEach(c => {
    // Convertir strings a tipos apropiados
    if (c.valor === 'true') configObj[c.clave] = true;
    else if (c.valor === 'false') configObj[c.clave] = false;
    else if (!isNaN(c.valor) && c.valor !== '') configObj[c.clave] = parseFloat(c.valor);
    else configObj[c.clave] = c.valor;
  });

  // Valores por defecto si no existen
  const defaults = {
    tienda_abierta: true,
    horario_apertura: '11:00',
    horario_cierre: '23:00',
    nombre_negocio: 'Nuestro Restaurante',
    tagline_negocio: 'Los mejores sabores',
    costo_delivery: 0,
    delivery_habilitado: true,
    direccion_retiro: '',
    mercadopago_enabled: false,
    efectivo_enabled: true
  };

  res.json({ ...defaults, ...configObj });
};

// Obtener todas las configuraciones (admin)
const obtenerTodas = async (req, res) => {
  const prisma = getPrisma(req);
  const config = await configuracionService.obtenerTodas(prisma, req.tenantId);
  res.json(config);
};

// Actualizar una configuración
const actualizar = async (req, res) => {
  const prisma = getPrisma(req);

  if (!req.params.clave) {
    throw createHttpError.badRequest('Clave requerida');
  }

  const config = await configuracionService.actualizar(prisma, req.tenantId, req.params.clave, req.body.valor);
  res.json(config);
};

// Actualizar múltiples configuraciones
const actualizarBulk = async (req, res) => {
  const prisma = getPrisma(req);
  const result = await configuracionService.actualizarBulk(prisma, req.tenantId, req.body);
  res.json(result);
};

// Subir banner
const subirBanner = async (req, res) => {
  const prisma = getPrisma(req);
  const result = await configuracionService.subirBanner(prisma, req.tenantId, req.file);
  res.json(result);
};

// Semilla de configuraciones iniciales para un tenant
const seedConfiguraciones = async (tenantId = 1) => {
  const defaults = [
    { clave: 'tienda_abierta', valor: 'true' },
    { clave: 'horario_apertura', valor: '11:00' },
    { clave: 'horario_cierre', valor: '23:00' },
    { clave: 'nombre_negocio', valor: 'Mi Restaurante' },
    { clave: 'tagline_negocio', valor: 'Los mejores sabores' },
    { clave: 'costo_delivery', valor: '1500' },
    { clave: 'delivery_habilitado', valor: 'true' },
    { clave: 'direccion_retiro', valor: 'Av. Principal 123' },
    { clave: 'mercadopago_enabled', valor: 'false' },
    { clave: 'efectivo_enabled', valor: 'true' },
    { clave: 'whatsapp_numero', valor: '' }
  ];

  for (const config of defaults) {
    await basePrisma.configuracion.upsert({
      where: {
        tenantId_clave: { tenantId, clave: config.clave }
      },
      update: {},
      create: { tenantId, ...config }
    });
  }
};

module.exports = {
  obtenerPublica,
  obtenerTodas,
  actualizar,
  actualizarBulk,
  subirBanner,
  seedConfiguraciones
};
