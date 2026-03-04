const crypto = require('crypto');
const forge = require('node-forge');
const { getPrisma } = require('../utils/get-prisma');
const { encrypt, decrypt } = require('../services/crypto.service');
const { testConexion } = require('../services/afip.service');
const { createHttpError } = require('../utils/http-error');

const obtenerEstadoFiscal = async (req, res) => {
  const prisma = getPrisma(req);

  const [negocio, afipConfig] = await Promise.all([
    prisma.negocio.findUnique({ where: { id: 1 } }),
    prisma.afipConfig.findUnique({ where: { id: 1 } })
  ]);

  res.json({
    fiscal: {
      cuit: negocio?.cuit || null,
      razonSocial: negocio?.razonSocial || null,
      condicionIva: negocio?.condicionIva || null,
      puntoVenta: negocio?.puntoVenta || null,
      domicilioFiscal: negocio?.domicilioFiscal || null,
      iibb: negocio?.iibb || null,
      inicioActividades: negocio?.inicioActividades || null
    },
    afip: {
      configurado: !!(afipConfig?.certificado && afipConfig?.clavePrivada),
      produccion: afipConfig?.produccion || false,
      isActive: afipConfig?.isActive || false,
      csrPendiente: afipConfig?.csrPendiente || false,
      tokenVigente: afipConfig?.tokenExpiration
        ? new Date(afipConfig.tokenExpiration) > new Date()
        : false
    }
  });
};

const configurarFiscal = async (req, res) => {
  const prisma = getPrisma(req);
  const data = { ...req.body };

  // Convertir inicioActividades string a Date si viene
  if (data.inicioActividades) {
    data.inicioActividades = new Date(data.inicioActividades);
  }

  const negocio = await prisma.negocio.update({
    where: { id: 1 },
    data
  });

  res.json({
    cuit: negocio.cuit,
    razonSocial: negocio.razonSocial,
    condicionIva: negocio.condicionIva,
    puntoVenta: negocio.puntoVenta,
    domicilioFiscal: negocio.domicilioFiscal,
    iibb: negocio.iibb,
    inicioActividades: negocio.inicioActividades
  });
};

const subirCertificado = async (req, res) => {
  const prisma = getPrisma(req);

  if (!req.files?.certificado?.[0] || !req.files?.clavePrivada?.[0]) {
    throw createHttpError.badRequest('Se requieren ambos archivos: certificado (.crt) y clave privada (.key)');
  }

  const certContent = req.files.certificado[0].buffer.toString('utf8');
  const keyContent = req.files.clavePrivada[0].buffer.toString('utf8');

  // Validaciones básicas
  if (!certContent.includes('BEGIN CERTIFICATE') && !certContent.includes('BEGIN TRUSTED CERTIFICATE')) {
    throw createHttpError.badRequest('El archivo de certificado no parece ser un PEM válido');
  }
  if (!keyContent.includes('BEGIN') || !keyContent.includes('KEY')) {
    throw createHttpError.badRequest('El archivo de clave privada no parece ser un PEM válido');
  }

  // Encriptar y guardar
  const certEncrypted = encrypt(certContent);
  const keyEncrypted = encrypt(keyContent);

  await prisma.afipConfig.upsert({
    where: { id: 1 },
    create: {
      certificado: certEncrypted,
      clavePrivada: keyEncrypted,
      isActive: true
    },
    update: {
      certificado: certEncrypted,
      clavePrivada: keyEncrypted,
      isActive: true,
      csrPendiente: false,
      // Invalidar token anterior al cambiar certificados
      token: null,
      sign: null,
      tokenExpiration: null
    }
  });

  res.json({ message: 'Certificados AFIP actualizados correctamente' });
};

const testConexionHandler = async (req, res) => {
  const prisma = getPrisma(req);
  const resultado = await testConexion(prisma);
  res.json(resultado);
};

const toggleModo = async (req, res) => {
  const prisma = getPrisma(req);
  const { produccion } = req.body;

  const config = await prisma.afipConfig.upsert({
    where: { id: 1 },
    create: { produccion },
    update: {
      produccion,
      // Invalidar token al cambiar modo
      token: null,
      sign: null,
      tokenExpiration: null
    }
  });

  res.json({
    produccion: config.produccion,
    message: `Modo AFIP cambiado a ${produccion ? 'Producción' : 'Homologación'}`
  });
};

const generarCSR = async (req, res) => {
  const prisma = getPrisma(req);
  const { cuit, alias, razonSocial: razonSocialBody } = req.body;

  // Obtener razonSocial del negocio si no viene en el body
  let razonSocial = razonSocialBody;
  if (!razonSocial) {
    const negocio = await prisma.negocio.findUnique({ where: { id: 1 } });
    razonSocial = negocio?.razonSocial;
    if (!razonSocial) {
      throw createHttpError.badRequest(
        'Razon social no proporcionada y no esta configurada en datos fiscales'
      );
    }
  }

  // Generar key pair RSA-2048 con crypto nativo (rapido, ~100ms)
  const { publicKey: pubPem, privateKey: keyPem } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicExponent: 0x10001,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  // Convertir a objetos forge para crear el CSR
  const forgePrivateKey = forge.pki.privateKeyFromPem(keyPem);
  const forgePublicKey = forge.pki.publicKeyFromPem(pubPem);

  // CUIT sin guiones para serialNumber (AFIP espera "CUIT XXXXXXXXXXX")
  const cuitSinGuiones = cuit.replace(/-/g, '');

  // Crear CSR
  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = forgePublicKey;
  csr.setSubject([
    { shortName: 'CN', value: alias },
    { shortName: 'O', value: razonSocial },
    { shortName: 'C', value: 'AR' },
    { type: '2.5.4.5', value: `CUIT ${cuitSinGuiones}` } // serialNumber OID
  ]);

  // Firmar CSR con SHA-256
  csr.sign(forgePrivateKey, forge.md.sha256.create());

  // Verificar que el CSR es valido
  if (!csr.verify()) {
    throw createHttpError.internal('Error interno: CSR generado no paso verificacion');
  }

  const csrPem = forge.pki.certificationRequestToPem(csr);

  // Encriptar y guardar clave privada
  const keyEncrypted = encrypt(keyPem);

  await prisma.afipConfig.upsert({
    where: { id: 1 },
    create: {
      clavePrivada: keyEncrypted,
      csrPendiente: true,
      isActive: false
    },
    update: {
      clavePrivada: keyEncrypted,
      certificado: null,
      csrPendiente: true,
      isActive: false,
      token: null,
      sign: null,
      tokenExpiration: null
    }
  });

  res.json({
    csrPem,
    message: 'CSR generado. Suba este archivo al portal de AFIP para obtener el certificado (.crt).'
  });
};

const subirSoloCertificado = async (req, res) => {
  const prisma = getPrisma(req);

  if (!req.file) {
    throw createHttpError.badRequest('Se requiere el archivo de certificado (.crt)');
  }

  const certContent = req.file.buffer.toString('utf8');

  // Validar formato PEM
  if (!certContent.includes('BEGIN CERTIFICATE') && !certContent.includes('BEGIN TRUSTED CERTIFICATE')) {
    throw createHttpError.badRequest('El archivo no parece ser un certificado PEM valido');
  }

  // Verificar que el certificado se puede parsear
  let cert;
  try {
    cert = forge.pki.certificateFromPem(certContent);
  } catch (err) {
    throw createHttpError.badRequest(`Certificado invalido: ${err.message}`);
  }

  // Cargar config existente para obtener la clave privada almacenada
  const config = await prisma.afipConfig.findUnique({ where: { id: 1 } });
  if (!config?.clavePrivada) {
    throw createHttpError.badRequest(
      'No hay clave privada almacenada. Genere un CSR primero o suba ambos archivos.'
    );
  }

  // Verificar que el certificado corresponde a la clave privada (comparar modulus RSA)
  try {
    const keyPem = decrypt(config.clavePrivada);
    const privateKey = forge.pki.privateKeyFromPem(keyPem);
    const certModulus = cert.publicKey.n.toString(16);
    const keyModulus = privateKey.n.toString(16);
    if (certModulus !== keyModulus) {
      throw createHttpError.badRequest(
        'El certificado no corresponde a la clave privada almacenada. ' +
        'Asegurese de subir el certificado generado por AFIP para el CSR que descargo de Comanda.'
      );
    }
  } catch (err) {
    if (err.status) throw err;
    throw createHttpError.badRequest(`Error al verificar correspondencia cert/key: ${err.message}`);
  }

  // Encriptar y guardar certificado
  const certEncrypted = encrypt(certContent);

  await prisma.afipConfig.update({
    where: { id: 1 },
    data: {
      certificado: certEncrypted,
      csrPendiente: false,
      isActive: true,
      token: null,
      sign: null,
      tokenExpiration: null
    }
  });

  res.json({ message: 'Certificado AFIP vinculado correctamente con la clave privada almacenada' });
};

module.exports = {
  obtenerEstadoFiscal,
  configurarFiscal,
  subirCertificado,
  generarCSR,
  subirSoloCertificado,
  testConexion: testConexionHandler,
  toggleModo
};
