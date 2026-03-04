/**
 * Servicio WSFEv1 para facturación electrónica AFIP.
 *
 * Provee acceso a los métodos del Web Service de Factura Electrónica:
 * - FECAESolicitar: solicitar CAE para un comprobante
 * - FECompUltimoAutorizado: obtener último número de comprobante
 * - FEDummy: verificar estado del servicio
 */

const soap = require('soap');
const { obtenerCredenciales } = require('./afip-auth.service');
const { createHttpError } = require('../utils/http-error');
const { logger } = require('../utils/logger');

const WSFE_URLS = {
  produccion: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL',
  homologacion: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL'
};

// Mapeo TipoComprobante enum → código numérico AFIP
const CBTE_TIPO_MAP = {
  FACTURA_A: 1,
  FACTURA_B: 6,
  FACTURA_C: 11,
  NOTA_CREDITO_A: 3,
  NOTA_CREDITO_B: 8,
  NOTA_CREDITO_C: 13,
  NOTA_DEBITO_A: 2,
  NOTA_DEBITO_B: 7,
  NOTA_DEBITO_C: 12
};

// Mapeo inverso
const CBTE_TIPO_REVERSE = Object.fromEntries(
  Object.entries(CBTE_TIPO_MAP).map(([k, v]) => [v, k])
);

// Mapeo condición IVA → tipos de comprobante permitidos
const TIPOS_POR_CONDICION = {
  RESPONSABLE_INSCRIPTO: ['FACTURA_A', 'FACTURA_B', 'NOTA_CREDITO_A', 'NOTA_CREDITO_B', 'NOTA_DEBITO_A', 'NOTA_DEBITO_B'],
  MONOTRIBUTISTA: ['FACTURA_C', 'NOTA_CREDITO_C', 'NOTA_DEBITO_C'],
  EXENTO: ['FACTURA_C', 'NOTA_CREDITO_C', 'NOTA_DEBITO_C']
};

const SOAP_TIMEOUT = 30000;
const RETRY_DELAY = 3000;

/**
 * Obtiene cliente SOAP WSFEv1 y credenciales Auth.
 */
const getClienteYAuth = async (prisma) => {
  const config = await prisma.afipConfig.findUnique({ where: { id: 1 } });
  if (!config) {
    throw createHttpError.badRequest('AFIP no está configurado');
  }

  const negocio = await prisma.negocio.findUnique({ where: { id: 1 } });
  if (!negocio?.cuit) {
    throw createHttpError.badRequest('CUIT del negocio no está configurado');
  }

  const { token, sign } = await obtenerCredenciales(prisma);
  const cuit = negocio.cuit.replace(/-/g, ''); // Quitar guiones: "20-12345678-9" → "20123456789"

  const wsfeUrl = config.produccion ? WSFE_URLS.produccion : WSFE_URLS.homologacion;
  const client = await soap.createClientAsync(wsfeUrl, {
    wsdl_options: { timeout: SOAP_TIMEOUT }
  });

  const auth = { Token: token, Sign: sign, Cuit: cuit };
  return { client, auth, config, negocio };
};

/**
 * Ejecuta método SOAP con 1 reintento en caso de error de red.
 */
const ejecutarConRetry = async (fn) => {
  try {
    return await fn();
  } catch (err) {
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET' || err.code === 'ENOTFOUND') {
      logger.warn(`WSFE: Reintentando tras error de red: ${err.code}`);
      await new Promise(r => setTimeout(r, RETRY_DELAY));
      return await fn();
    }
    throw err;
  }
};

/**
 * Solicita CAE para un comprobante.
 */
const solicitarCAE = async (prisma, datos) => {
  try {
    const { client, auth } = await getClienteYAuth(prisma);

    const feCAEReq = {
      FeCabReq: {
        CantReg: 1,
        PtoVta: datos.puntoVenta,
        CbteTipo: datos.cbteTipo
      },
      FeDetReq: {
        FECAEDetRequest: [{
          Concepto: datos.concepto || 1,
          DocTipo: datos.docTipo,
          DocNro: datos.docNro,
          CbteDesde: datos.nroComprobante,
          CbteHasta: datos.nroComprobante,
          CbteFch: datos.fechaComprobante, // YYYYMMDD
          ImpTotal: datos.importeTotal,
          ImpTotConc: 0, // No gravado
          ImpNeto: datos.importeNeto,
          ImpOpEx: datos.importeExento || 0,
          ImpTrib: datos.importeTributos || 0,
          ImpIVA: datos.importeIva,
          MonId: datos.moneda || 'PES',
          MonCotiz: datos.cotizacion || 1,
          ...(datos.iva && datos.iva.length > 0 ? {
            Iva: { AlicIva: datos.iva }
          } : {}),
          ...(datos.concepto >= 2 ? {
            FchServDesde: datos.fechaServDesde,
            FchServHasta: datos.fechaServHasta,
            FchVtoPago: datos.fechaVtoPago
          } : {}),
          ...(datos.cbtesAsoc ? {
            CbtesAsoc: { CbteAsoc: datos.cbtesAsoc }
          } : {})
        }]
      }
    };

    const [result] = await ejecutarConRetry(() =>
      client.FECAESolicitarAsync({ Auth: auth, FeCAEReq: feCAEReq })
    );

    const response = result.FECAESolicitarResult;

    // Verificar errores generales
    if (response.Errors) {
      const errores = Array.isArray(response.Errors.Err)
        ? response.Errors.Err
        : [response.Errors.Err];
      const mensajes = errores.map(e => `[${e.Code}] ${e.Msg}`).join('; ');
      logger.error('WSFE FECAESolicitar error:', { errores });
      return {
        cae: null,
        caeFchVto: null,
        resultado: 'R',
        observaciones: mensajes,
        errores
      };
    }

    // Resultado del detalle
    const detalle = response.FeDetResp?.FECAEDetResponse?.[0];
    if (!detalle) {
      return {
        cae: null,
        caeFchVto: null,
        resultado: 'R',
        observaciones: 'Respuesta AFIP sin detalle',
        errores: []
      };
    }

    const observaciones = detalle.Observaciones
      ? (Array.isArray(detalle.Observaciones.Obs)
        ? detalle.Observaciones.Obs
        : [detalle.Observaciones.Obs])
        .map(o => `[${o.Code}] ${o.Msg}`).join('; ')
      : null;

    return {
      cae: detalle.CAE || null,
      caeFchVto: detalle.CAEFchVto || null,
      resultado: detalle.Resultado, // "A" o "R"
      observaciones,
      errores: detalle.Observaciones ? (Array.isArray(detalle.Observaciones.Obs) ? detalle.Observaciones.Obs : [detalle.Observaciones.Obs]) : []
    };
  } catch (err) {
    if (err.status) throw err;
    logger.error('WSFE FECAESolicitar excepción:', { error: err.message });
    throw createHttpError.serviceUnavailable(`Error comunicando con AFIP: ${err.message}`);
  }
};

/**
 * Obtiene el último número de comprobante autorizado.
 */
const obtenerUltimoComprobante = async (prisma, puntoVenta, cbteTipo) => {
  try {
    const { client, auth } = await getClienteYAuth(prisma);

    const [result] = await ejecutarConRetry(() =>
      client.FECompUltimoAutorizadoAsync({
        Auth: auth,
        PtoVta: puntoVenta,
        CbteTipo: cbteTipo
      })
    );

    const response = result.FECompUltimoAutorizadoResult;

    if (response.Errors) {
      const errores = Array.isArray(response.Errors.Err)
        ? response.Errors.Err
        : [response.Errors.Err];
      throw new Error(errores.map(e => `[${e.Code}] ${e.Msg}`).join('; '));
    }

    return response.CbteNro || 0;
  } catch (err) {
    if (err.status) throw err;
    logger.error('WSFE FECompUltimoAutorizado error:', { error: err.message });
    throw createHttpError.serviceUnavailable(`Error consultando último comprobante AFIP: ${err.message}`);
  }
};

/**
 * Verifica el estado del servicio WSFEv1.
 */
const testConexion = async (prisma) => {
  try {
    const config = await prisma.afipConfig.findUnique({ where: { id: 1 } });
    if (!config) {
      return { ok: false, message: 'AFIP no está configurado' };
    }

    const wsfeUrl = config.produccion ? WSFE_URLS.produccion : WSFE_URLS.homologacion;
    const client = await soap.createClientAsync(wsfeUrl, {
      wsdl_options: { timeout: SOAP_TIMEOUT }
    });

    const [result] = await client.FEDummyAsync({});
    const response = result.FEDummyResult;

    const appServer = response.AppServer;
    const dbServer = response.DbServer;
    const authServer = response.AuthServer;

    const todosOk = appServer === 'OK' && dbServer === 'OK' && authServer === 'OK';

    return {
      ok: todosOk,
      message: todosOk
        ? `Servicio AFIP operativo (${config.produccion ? 'Producción' : 'Homologación'})`
        : `Servicio AFIP con problemas - App:${appServer} DB:${dbServer} Auth:${authServer}`,
      appServer,
      dbServer,
      authServer,
      modo: config.produccion ? 'produccion' : 'homologacion'
    };
  } catch (err) {
    logger.error('WSFE FEDummy error:', { error: err.message });
    return {
      ok: false,
      message: `No se pudo conectar con AFIP: ${err.message}`
    };
  }
};

module.exports = {
  solicitarCAE,
  obtenerUltimoComprobante,
  testConexion,
  CBTE_TIPO_MAP,
  CBTE_TIPO_REVERSE,
  TIPOS_POR_CONDICION
};
