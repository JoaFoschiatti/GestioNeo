const { prisma } = require('../db/prisma');
const path = require('path');
const fs = require('fs');

// Obtener configuración pública (sin auth) - DEPRECATED, usar /api/publico/:slug/config
const obtenerPublica = async (req, res) => {
  try {
    // Para backwards compatibility, usar tenant por defecto
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
  } catch (error) {
    console.error('Error al obtener configuración pública:', error);
    res.status(500).json({ error: { message: 'Error al obtener configuración' } });
  }
};

// Obtener todas las configuraciones (admin)
const obtenerTodas = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: { message: 'Tenant no identificado' } });
    }

    const configs = await prisma.configuracion.findMany({
      where: { tenantId }
    });

    // Convertir a objeto
    const configObj = {};
    configs.forEach(c => {
      configObj[c.clave] = c.valor;
    });

    res.json(configObj);
  } catch (error) {
    console.error('Error al obtener configuraciones:', error);
    res.status(500).json({ error: { message: 'Error al obtener configuraciones' } });
  }
};

// Actualizar una configuración
const actualizar = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { clave } = req.params;
    const { valor } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: { message: 'Tenant no identificado' } });
    }

    const config = await prisma.configuracion.upsert({
      where: {
        tenantId_clave: { tenantId, clave }
      },
      update: { valor: String(valor) },
      create: { tenantId, clave, valor: String(valor) }
    });

    res.json(config);
  } catch (error) {
    console.error('Error al actualizar configuración:', error);
    res.status(500).json({ error: { message: 'Error al actualizar configuración' } });
  }
};

// Actualizar múltiples configuraciones
const actualizarBulk = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const configs = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: { message: 'Tenant no identificado' } });
    }

    const updates = await Promise.all(
      Object.entries(configs).map(([clave, valor]) =>
        prisma.configuracion.upsert({
          where: {
            tenantId_clave: { tenantId, clave }
          },
          update: { valor: String(valor) },
          create: { tenantId, clave, valor: String(valor) }
        })
      )
    );

    res.json({ message: 'Configuraciones actualizadas', count: updates.length });
  } catch (error) {
    console.error('Error al actualizar configuraciones:', error);
    res.status(500).json({ error: { message: 'Error al actualizar configuraciones' } });
  }
};

// Subir banner
const subirBanner = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: { message: 'Tenant no identificado' } });
    }

    if (!req.file) {
      return res.status(400).json({ error: { message: 'No se subió ninguna imagen' } });
    }

    const bannerUrl = `/uploads/${req.file.filename}`;

    // Guardar en configuración
    await prisma.configuracion.upsert({
      where: {
        tenantId_clave: { tenantId, clave: 'banner_imagen' }
      },
      update: { valor: bannerUrl },
      create: { tenantId, clave: 'banner_imagen', valor: bannerUrl }
    });

    res.json({ url: bannerUrl, message: 'Banner subido correctamente' });
  } catch (error) {
    console.error('Error al subir banner:', error);
    res.status(500).json({ error: { message: 'Error al subir banner' } });
  }
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
    await prisma.configuracion.upsert({
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
