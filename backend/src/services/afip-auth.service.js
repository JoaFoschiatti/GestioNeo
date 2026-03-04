/**
 * Servicio de autenticación WSAA para AFIP.
 *
 * Genera LoginTicketRequest, lo firma con PKCS#7/CMS usando el certificado
 * digital del contribuyente, y obtiene token + sign para usar en WSFEv1.
 * Los tokens se cachean en AfipConfig (~12h de validez).
 */

const soap = require('soap');
const forge = require('node-forge');
const fs = require('fs');
const { encrypt, decrypt } = require('./crypto.service');
const { createHttpError } = require('../utils/http-error');
const { logger } = require('../utils/logger');

const WSAA_URLS = {
  produccion: 'https://wsaa.afip.gov.ar/ws/services/LoginCms?WSDL',
  homologacion: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms?WSDL'
};

const SERVICE_NAME = 'wsfe';
const TOKEN_MARGIN_MS = 10 * 60 * 1000; // 10 min antes de expirar, renovar

/**
 * Obtiene credenciales WSAA (token + sign), usando cache si es válido.
 */
const obtenerCredenciales = async (prisma) => {
  const config = await prisma.afipConfig.findUnique({ where: { id: 1 } });

  if (!config) {
    throw createHttpError.badRequest('AFIP no está configurado. Suba el certificado y clave privada.');
  }

  if (!config.certificado || !config.clavePrivada) {
    throw createHttpError.badRequest('Certificado y clave privada AFIP no están cargados.');
  }

  // Verificar si el token cacheado sigue vigente
  if (config.token && config.sign && config.tokenExpiration) {
    const ahora = new Date();
    const expira = new Date(config.tokenExpiration);
    if (expira.getTime() - ahora.getTime() > TOKEN_MARGIN_MS) {
      return { token: config.token, sign: config.sign };
    }
  }

  // Renovar credenciales
  return renovarCredenciales(prisma, config);
};

/**
 * Renueva credenciales llamando a WSAA LoginCms.
 */
const renovarCredenciales = async (prisma, afipConfig) => {
  try {
    // Desencriptar certificado y clave
    let certPem, keyPem;
    try {
      certPem = decrypt(afipConfig.certificado);
      keyPem = decrypt(afipConfig.clavePrivada);
    } catch (err) {
      throw createHttpError.badRequest('Error al desencriptar certificados AFIP. Verifique la ENCRYPTION_KEY.');
    }

    // Si hay paths en env, usarlos como override
    if (process.env.AFIP_CERT_PATH && process.env.AFIP_KEY_PATH) {
      try {
        certPem = fs.readFileSync(process.env.AFIP_CERT_PATH, 'utf8');
        keyPem = fs.readFileSync(process.env.AFIP_KEY_PATH, 'utf8');
      } catch (err) {
        logger.warn('No se pudieron leer certificados desde paths env, usando DB');
      }
    }

    // Generar LoginTicketRequest XML
    const loginTicketRequest = generarLoginTicketRequest(SERVICE_NAME);

    // Firmar con PKCS#7/CMS
    const signedCMS = firmarCMS(loginTicketRequest, certPem, keyPem);

    // Llamar WSAA
    const wsaaUrl = afipConfig.produccion ? WSAA_URLS.produccion : WSAA_URLS.homologacion;
    const resultado = await llamarLoginCms(signedCMS, wsaaUrl);

    // Guardar en DB
    await prisma.afipConfig.update({
      where: { id: 1 },
      data: {
        token: resultado.token,
        sign: resultado.sign,
        tokenExpiration: resultado.expirationTime
      }
    });

    logger.info('WSAA: Credenciales renovadas exitosamente');
    return { token: resultado.token, sign: resultado.sign };
  } catch (err) {
    if (err.status) throw err; // Re-throw HTTP errors
    logger.error('WSAA: Error renovando credenciales', { error: err.message });
    throw createHttpError.serviceUnavailable(`Error de autenticación AFIP: ${err.message}`);
  }
};

/**
 * Genera el XML LoginTicketRequest para WSAA.
 */
const generarLoginTicketRequest = (service) => {
  const now = new Date();
  const generationTime = new Date(now.getTime() - 60000); // 1 min atrás
  const expirationTime = new Date(now.getTime() + 600000); // 10 min adelante

  const formatDate = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Math.floor(Date.now() / 1000)}</uniqueId>
    <generationTime>${formatDate(generationTime)}</generationTime>
    <expirationTime>${formatDate(expirationTime)}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`;
};

/**
 * Firma el LoginTicketRequest con PKCS#7/CMS usando node-forge.
 * AFIP requiere firma CMS detached en base64.
 */
const firmarCMS = (xml, certPem, keyPem) => {
  try {
    const cert = forge.pki.certificateFromPem(certPem);
    const privateKey = forge.pki.privateKeyFromPem(keyPem);

    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(xml, 'utf8');
    p7.addCertificate(cert);
    p7.addSigner({
      key: privateKey,
      certificate: cert,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        { type: forge.pki.oids.messageDigest },
        { type: forge.pki.oids.signingTime, value: new Date() }
      ]
    });
    p7.sign();

    const asn1 = p7.toAsn1();
    const der = forge.asn1.toDer(asn1).getBytes();
    return forge.util.encode64(der);
  } catch (err) {
    throw new Error(`Error firmando CMS: ${err.message}`);
  }
};

/**
 * Llama al método LoginCms de WSAA vía SOAP.
 */
const llamarLoginCms = async (signedCMS, wsaaUrl) => {
  const client = await soap.createClientAsync(wsaaUrl, {
    wsdl_options: { timeout: 30000 }
  });

  const [result] = await client.loginCmsAsync({ in0: signedCMS });

  const loginTicketResponse = result.loginCmsReturn;

  // Parsear XML de respuesta
  const tokenMatch = loginTicketResponse.match(/<token>(.+?)<\/token>/s);
  const signMatch = loginTicketResponse.match(/<sign>(.+?)<\/sign>/s);
  const expirationMatch = loginTicketResponse.match(/<expirationTime>(.+?)<\/expirationTime>/s);

  if (!tokenMatch || !signMatch) {
    throw new Error('Respuesta WSAA inválida: no se encontró token o sign');
  }

  return {
    token: tokenMatch[1],
    sign: signMatch[1],
    expirationTime: expirationMatch ? new Date(expirationMatch[1]) : new Date(Date.now() + 12 * 60 * 60 * 1000)
  };
};

module.exports = {
  obtenerCredenciales,
  renovarCredenciales,
  generarLoginTicketRequest,
  firmarCMS
};
