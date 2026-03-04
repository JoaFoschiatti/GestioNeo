const { createHttpError } = require('../utils/http-error');

const normalizeValor = (valor) => String(valor ?? '');

const sanitizeOptionalText = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
};

const obtenerTodas = async (prisma) => {
  const configs = await prisma.configuracion.findMany({
    orderBy: { clave: 'asc' }
  });

  return configs.reduce((acc, config) => {
    acc[config.clave] = config.valor;
    return acc;
  }, {});
};

const actualizar = async (prisma, clave, valor) => {
  if (!clave) {
    throw createHttpError.badRequest('Clave requerida');
  }

  return prisma.configuracion.upsert({
    where: { clave },
    update: { valor: normalizeValor(valor) },
    create: { clave, valor: normalizeValor(valor) }
  });
};

const actualizarBulk = async (prisma, configs) => {
  const entries = Object.entries(configs || {});

  if (entries.length === 0) {
    return { message: 'Configuraciones actualizadas', count: 0 };
  }

  const updates = await Promise.all(
    entries.map(([clave, valor]) =>
      prisma.configuracion.upsert({
        where: { clave },
        update: { valor: normalizeValor(valor) },
        create: { clave, valor: normalizeValor(valor) }
      })
    )
  );

  return { message: 'Configuraciones actualizadas', count: updates.length };
};

const subirBanner = async (prisma, file) => {
  if (!file) {
    throw createHttpError.badRequest('No se subió ninguna imagen');
  }

  const bannerUrl = `/uploads/${file.filename}`;

  await prisma.configuracion.upsert({
    where: { clave: 'banner_imagen' },
    update: { valor: bannerUrl },
    create: { clave: 'banner_imagen', valor: bannerUrl }
  });

  return { url: bannerUrl, message: 'Banner subido correctamente' };
};

const obtenerNegocio = async (prisma) => {
  const negocio = await prisma.negocio.findUnique({
    where: { id: 1 }
  });

  if (negocio) return negocio;

  return prisma.negocio.create({
    data: {
      id: 1,
      nombre: 'Mi Negocio',
      email: 'contacto@example.com',
      colorPrimario: '#3B82F6',
      colorSecundario: '#1E40AF'
    }
  });
};

const actualizarNegocio = async (prisma, data) => {
  const payload = {
    nombre: data.nombre?.trim(),
    email: data.email?.trim(),
    telefono: sanitizeOptionalText(data.telefono),
    direccion: sanitizeOptionalText(data.direccion),
    logo: sanitizeOptionalText(data.logo),
    bannerUrl: sanitizeOptionalText(data.bannerUrl),
    colorPrimario: data.colorPrimario,
    colorSecundario: data.colorSecundario
  };

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  });

  if (Object.keys(payload).length === 0) {
    throw createHttpError.badRequest('No hay campos para actualizar');
  }

  return prisma.negocio.upsert({
    where: { id: 1 },
    update: payload,
    create: {
      id: 1,
      nombre: payload.nombre || 'Mi Negocio',
      email: payload.email || 'contacto@example.com',
      telefono: payload.telefono ?? null,
      direccion: payload.direccion ?? null,
      logo: payload.logo ?? null,
      bannerUrl: payload.bannerUrl ?? null,
      colorPrimario: payload.colorPrimario || '#3B82F6',
      colorSecundario: payload.colorSecundario || '#1E40AF'
    }
  });
};

module.exports = {
  obtenerTodas,
  actualizar,
  actualizarBulk,
  subirBanner,
  obtenerNegocio,
  actualizarNegocio
};

