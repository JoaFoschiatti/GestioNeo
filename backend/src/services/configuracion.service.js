const { createHttpError } = require('../utils/http-error');

const obtenerTodas = async (prisma, tenantId) => {
  if (!tenantId) {
    throw createHttpError.badRequest('Tenant no identificado');
  }

  const configs = await prisma.configuracion.findMany({
    where: { tenantId }
  });

  return configs.reduce((acc, config) => {
    acc[config.clave] = config.valor;
    return acc;
  }, {});
};

const actualizar = async (prisma, tenantId, clave, valor) => {
  if (!tenantId) {
    throw createHttpError.badRequest('Tenant no identificado');
  }

  if (!clave) {
    throw createHttpError.badRequest('Clave requerida');
  }

  return prisma.configuracion.upsert({
    where: {
      tenantId_clave: { tenantId, clave }
    },
    update: { valor: String(valor) },
    create: { tenantId, clave, valor: String(valor) }
  });
};

const actualizarBulk = async (prisma, tenantId, configs) => {
  if (!tenantId) {
    throw createHttpError.badRequest('Tenant no identificado');
  }

  const entries = Object.entries(configs || {});

  if (entries.length === 0) {
    return { message: 'Configuraciones actualizadas', count: 0 };
  }

  const updates = await Promise.all(
    entries.map(([clave, valor]) =>
      prisma.configuracion.upsert({
        where: {
          tenantId_clave: { tenantId, clave }
        },
        update: { valor: String(valor) },
        create: { tenantId, clave, valor: String(valor) }
      })
    )
  );

  return { message: 'Configuraciones actualizadas', count: updates.length };
};

const subirBanner = async (prisma, tenantId, file) => {
  if (!tenantId) {
    throw createHttpError.badRequest('Tenant no identificado');
  }

  if (!file) {
    throw createHttpError.badRequest('No se subió ninguna imagen');
  }

  const bannerUrl = `/uploads/${file.filename}`;

  await prisma.configuracion.upsert({
    where: {
      tenantId_clave: { tenantId, clave: 'banner_imagen' }
    },
    update: { valor: bannerUrl },
    create: { tenantId, clave: 'banner_imagen', valor: bannerUrl }
  });

  return { url: bannerUrl, message: 'Banner subido correctamente' };
};

module.exports = {
  obtenerTodas,
  actualizar,
  actualizarBulk,
  subirBanner
};

