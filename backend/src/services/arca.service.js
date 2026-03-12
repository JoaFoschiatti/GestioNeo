const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { createHttpError } = require('../utils/http-error');

const execFileAsync = promisify(execFile);

const WSAA_SERVICE_ID = 'wsfe';
const WSFE_NAMESPACE = 'http://ar.gov.afip.dif.FEV1/';
const WSAA_NAMESPACE = 'http://wsaa.view.sua.dvadac.desein.afip.gov';
const TA_REFRESH_MARGIN_MS = 5 * 60 * 1000;
const DEFAULT_IVA_ALICUOTAS = {
  0: 3,
  2.5: 9,
  5: 8,
  10.5: 4,
  21: 5,
  27: 6
};

const WSAA_URLS = {
  homologacion: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
  produccion: 'https://wsaa.afip.gov.ar/ws/services/LoginCms'
};

const WSFE_URLS = {
  homologacion: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
  produccion: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx'
};

const taCache = new Map();
const referenceCache = new Map();

class ArcaServiceError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ArcaServiceError';
    this.code = options.code || 'ARCA_ERROR';
    this.status = options.status || 502;
    this.details = options.details || [];
    this.events = options.events || [];
    this.responseXml = options.responseXml || null;
    this.requestPayload = options.requestPayload || null;
  }
}

const roundAmount = (value) => {
  const numeric = Number.parseFloat(value || 0);
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
};

const normalizeDigits = (value) => String(value || '').replace(/\D+/g, '');

const normalizeLookup = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Za-z0-9]+/g, ' ')
  .trim()
  .toUpperCase();

const escapeXml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const decodeXmlEntities = (value) => String(value || '')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, '\'')
  .replace(/&#39;/g, '\'')
  .replace(/&amp;/g, '&');

const escapeTagName = (tagName) => tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const extractTag = (xml, tagName) => {
  const pattern = new RegExp(`<(?:\\w+:)?${escapeTagName(tagName)}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${escapeTagName(tagName)}>`, 'i');
  const match = pattern.exec(xml || '');
  return match ? decodeXmlEntities(match[1].trim()) : null;
};

const extractBlocks = (xml, tagName) => {
  const pattern = new RegExp(`<(?:\\w+:)?${escapeTagName(tagName)}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${escapeTagName(tagName)}>`, 'gi');
  return [...String(xml || '').matchAll(pattern)].map((match) => match[1]);
};

const parseCodeMessages = (xml, containerTag, itemTag) => {
  const container = extractTag(xml, containerTag);
  if (!container) {
    return [];
  }

  return extractBlocks(container, itemTag).map((block) => ({
    code: Number.parseInt(extractTag(block, 'Code') || '', 10) || null,
    message: extractTag(block, 'Msg') || ''
  }));
};

const formatDateTimeForWsaa = (date) => {
  const pad = (value) => String(value).padStart(2, '0');
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMinutes);
  const offsetHours = pad(Math.floor(absOffset / 60));
  const offsetMins = pad(absOffset % 60);

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${offsetHours}:${offsetMins}`;
};

const formatArcaDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const parseArcaDate = (value) => {
  if (!value || !/^\d{8}$/.test(String(value))) {
    return null;
  }

  const raw = String(value);
  return new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00.000Z`);
};

const formatComprobanteNumber = (pointOfSale, number) => (
  `${String(pointOfSale).padStart(5, '0')}-${String(number).padStart(8, '0')}`
);

const resolveArcaEnvironment = (value = process.env.ARCA_AMBIENTE || 'homologacion') => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'produccion' ? 'produccion' : 'homologacion';
};

const getArcaRuntimeConfig = (ambiente) => {
  const resolvedEnvironment = resolveArcaEnvironment(ambiente);

  return {
    ambiente: resolvedEnvironment,
    cuit: normalizeDigits(process.env.ARCA_CUIT),
    certPath: process.env.ARCA_CERT_PATH?.trim() || '',
    keyPath: process.env.ARCA_KEY_PATH?.trim() || '',
    keyPassphrase: process.env.ARCA_KEY_PASSPHRASE || '',
    opensslBin: process.env.ARCA_OPENSSL_BIN?.trim() || 'openssl',
    wsaaUrl: process.env.ARCA_WSAA_URL?.trim() || WSAA_URLS[resolvedEnvironment],
    wsfeUrl: process.env.ARCA_WSFE_URL?.trim() || WSFE_URLS[resolvedEnvironment]
  };
};

const hasArcaRuntimeConfig = (ambiente) => {
  const config = getArcaRuntimeConfig(ambiente);
  return Boolean(config.cuit && config.certPath && config.keyPath);
};

const ensureRuntimeConfig = (ambiente) => {
  const config = getArcaRuntimeConfig(ambiente);

  if (!config.cuit || !config.certPath || !config.keyPath) {
    throw createHttpError.badRequest('Falta configurar ARCA_CUIT, ARCA_CERT_PATH y ARCA_KEY_PATH en el servidor');
  }

  // Validate certificate paths are absolute to prevent path traversal
  if (!path.isAbsolute(config.certPath)) {
    throw createHttpError.internal('ARCA_CERT_PATH debe ser una ruta absoluta');
  }
  if (!path.isAbsolute(config.keyPath)) {
    throw createHttpError.internal('ARCA_KEY_PATH debe ser una ruta absoluta');
  }

  return config;
};

const buildWsaaEnvelope = (cms) => `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="${WSAA_NAMESPACE}">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${cms}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;

const buildWsfeEnvelope = (operationXml) => `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    ${operationXml}
  </soap:Body>
</soap:Envelope>`;

const buildLoginTicketRequest = (serviceId = WSAA_SERVICE_ID, now = new Date()) => {
  const generationTime = new Date(now.getTime() - 10 * 60 * 1000);
  const expirationTime = new Date(now.getTime() + 10 * 60 * 1000);
  const uniqueId = Math.floor(now.getTime() / 1000);

  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${formatDateTimeForWsaa(generationTime)}</generationTime>
    <expirationTime>${formatDateTimeForWsaa(expirationTime)}</expirationTime>
  </header>
  <service>${serviceId}</service>
</loginTicketRequest>`;
};

const signCms = async (xml, runtimeConfig) => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const inputPath = path.join(os.tmpdir(), `comanda-arca-${stamp}-tra.xml`);
  const outputPath = path.join(os.tmpdir(), `comanda-arca-${stamp}-cms.pem`);
  const args = [
    'cms',
    '-sign',
    '-in',
    inputPath,
    '-signer',
    runtimeConfig.certPath,
    '-inkey',
    runtimeConfig.keyPath,
    '-nodetach',
    '-outform',
    'PEM',
    '-out',
    outputPath
  ];

  if (runtimeConfig.keyPassphrase) {
    args.push('-passin', `pass:${runtimeConfig.keyPassphrase}`);
  }

  await fs.writeFile(inputPath, xml, 'utf8');

  try {
    await execFileAsync(runtimeConfig.opensslBin, args, {
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024
    });
    const signedCms = await fs.readFile(outputPath, 'utf8');
    return signedCms
      .replace(/-----BEGIN [^-]+-----/g, '')
      .replace(/-----END [^-]+-----/g, '')
      .replace(/\s+/g, '');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw createHttpError.internal('No se encontro openssl en el servidor. En EC2 instala openssl o define ARCA_OPENSSL_BIN');
    }

    const stderr = error.stderr?.trim();
    throw createHttpError.internal(stderr || error.message || 'No se pudo firmar el Login Ticket de ARCA');
  } finally {
    await Promise.allSettled([
      fs.unlink(inputPath),
      fs.unlink(outputPath)
    ]);
  }
};

const callSoapService = async ({ url, soapAction, envelope }) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: soapAction,
      'User-Agent': 'Comanda/1.0'
    },
    body: envelope
  });
  const text = await response.text();

  if (!response.ok) {
    throw new ArcaServiceError(`ARCA respondio HTTP ${response.status}`, {
      code: 'ARCA_HTTP_ERROR',
      status: 502,
      responseXml: text
    });
  }

  const faultString = extractTag(text, 'faultstring');
  if (faultString) {
    throw new ArcaServiceError(faultString, {
      code: 'ARCA_SOAP_FAULT',
      status: 502,
      responseXml: text
    });
  }

  return text;
};

const parseWsaaTicket = (soapXml) => {
  const rawTicket = extractTag(soapXml, 'loginCmsReturn') || extractTag(soapXml, 'loginCmsResult');
  const ticketXml = decodeXmlEntities(rawTicket || '');
  const token = extractTag(ticketXml, 'token');
  const sign = extractTag(ticketXml, 'sign');
  const expirationTime = extractTag(ticketXml, 'expirationTime');
  const generationTime = extractTag(ticketXml, 'generationTime');

  if (!token || !sign || !expirationTime) {
    throw new ArcaServiceError('WSAA no devolvio un ticket de acceso valido', {
      code: 'ARCA_INVALID_TA',
      status: 502,
      responseXml: soapXml
    });
  }

  return {
    token,
    sign,
    generationTime,
    expirationTime,
    expirationDate: new Date(expirationTime)
  };
};

const getAccessTicket = async (ambiente) => {
  const runtimeConfig = ensureRuntimeConfig(ambiente);
  const cacheKey = [
    runtimeConfig.ambiente,
    runtimeConfig.cuit,
    runtimeConfig.certPath,
    runtimeConfig.keyPath
  ].join(':');
  const cached = taCache.get(cacheKey);

  if (cached && cached.expirationDate.getTime() - TA_REFRESH_MARGIN_MS > Date.now()) {
    return {
      runtimeConfig,
      ticket: cached
    };
  }

  const traXml = buildLoginTicketRequest(WSAA_SERVICE_ID);
  const cms = await signCms(traXml, runtimeConfig);
  const soapXml = await callSoapService({
    url: runtimeConfig.wsaaUrl,
    soapAction: 'urn:LoginCms',
    envelope: buildWsaaEnvelope(cms)
  });
  const ticket = parseWsaaTicket(soapXml);

  taCache.set(cacheKey, ticket);

  return {
    runtimeConfig,
    ticket
  };
};

const buildAuthXml = (ticket, cuit) => `
<Auth>
  <Token>${escapeXml(ticket.token)}</Token>
  <Sign>${escapeXml(ticket.sign)}</Sign>
  <Cuit>${escapeXml(cuit)}</Cuit>
</Auth>`;

const callWsfe = async ({ ambiente, method, bodyXml, parseResultTag = true }) => {
  const { runtimeConfig, ticket } = await getAccessTicket(ambiente);
  const responseXml = await callSoapService({
    url: runtimeConfig.wsfeUrl,
    soapAction: `http://ar.gov.afip.dif.FEV1/${method}`,
    envelope: buildWsfeEnvelope(`<${method} xmlns="${WSFE_NAMESPACE}">${buildAuthXml(ticket, runtimeConfig.cuit)}${bodyXml}</${method}>`)
  });
  const resultXml = parseResultTag
    ? (extractTag(responseXml, `${method}Result`) || responseXml)
    : responseXml;
  const errors = parseCodeMessages(resultXml, 'Errors', 'Err');
  const events = parseCodeMessages(resultXml, 'Events', 'Evt');

  return {
    runtimeConfig,
    ticket,
    responseXml,
    resultXml,
    errors,
    events
  };
};

const getLastAuthorizedVoucher = async ({ ambiente, pointOfSale, voucherType }) => {
  const result = await callWsfe({
    ambiente,
    method: 'FECompUltimoAutorizado',
    bodyXml: `
<PtoVta>${pointOfSale}</PtoVta>
<CbteTipo>${voucherType}</CbteTipo>`
  });
  const number = Number.parseInt(extractTag(result.resultXml, 'CbteNro') || '', 10);

  if (Number.isFinite(number)) {
    return {
      number,
      events: result.events,
      responseXml: result.responseXml
    };
  }

  if (result.errors.some((item) => /no existen comprobantes/i.test(item.message))) {
    return {
      number: 0,
      events: result.events,
      responseXml: result.responseXml
    };
  }

  if (result.errors.length > 0) {
    throw new ArcaServiceError(result.errors.map((item) => item.message).join(' | '), {
      code: 'ARCA_FE_ERROR',
      status: 400,
      details: result.errors,
      events: result.events,
      responseXml: result.responseXml
    });
  }

  throw new ArcaServiceError('ARCA no devolvio el ultimo numero de comprobante autorizado', {
    code: 'ARCA_INVALID_LAST_VOUCHER',
    status: 502,
    events: result.events,
    responseXml: result.responseXml
  });
};

const getReceiverVatConditions = async ({ ambiente, invoiceClass }) => {
  const cacheKey = `${resolveArcaEnvironment(ambiente)}:${invoiceClass || '*'}`;

  if (referenceCache.has(cacheKey)) {
    return referenceCache.get(cacheKey);
  }

  const bodyXml = invoiceClass
    ? `<ClaseCmp>${escapeXml(invoiceClass)}</ClaseCmp>`
    : '<ClaseCmp></ClaseCmp>';
  const result = await callWsfe({
    ambiente,
    method: 'FEParamGetCondicionIvaReceptor',
    bodyXml
  });

  if (result.errors.length > 0) {
    throw new ArcaServiceError(result.errors.map((item) => item.message).join(' | '), {
      code: 'ARCA_REFERENCE_ERROR',
      status: 400,
      details: result.errors,
      events: result.events,
      responseXml: result.responseXml
    });
  }

  const values = extractBlocks(extractTag(result.resultXml, 'ResultGet'), 'CondicionIvaReceptor').map((block) => ({
    id: Number.parseInt(extractTag(block, 'Id') || '', 10),
    description: extractTag(block, 'Desc') || '',
    invoiceClass: extractTag(block, 'Cmp_Clase') || ''
  })).filter((item) => Number.isFinite(item.id));

  referenceCache.set(cacheKey, values);
  return values;
};

const resolveInvoiceSpec = (tipoComprobante) => {
  const normalized = normalizeLookup(tipoComprobante);

  if (['FACTURA A', 'FACTURA_A', 'A'].includes(normalized)) {
    return { code: 1, label: 'FACTURA_A', invoiceClass: 'A' };
  }

  if (['FACTURA B', 'FACTURA_B', 'B'].includes(normalized)) {
    return { code: 6, label: 'FACTURA_B', invoiceClass: 'B' };
  }

  if (['CONSUMIDOR FINAL', 'CONSUMIDOR_FINAL', 'CF'].includes(normalized)) {
    return { code: 6, label: 'CONSUMIDOR_FINAL', invoiceClass: 'B' };
  }

  if (['FACTURA C', 'FACTURA_C', 'C'].includes(normalized)) {
    return { code: 11, label: 'FACTURA_C', invoiceClass: 'C' };
  }

  throw createHttpError.badRequest('Tipo de comprobante fiscal no soportado');
};

const resolveDocumentType = (clienteFiscal, invoiceSpec) => {
  const docTypeRaw = clienteFiscal?.tipoDocumento || '';
  const cuit = normalizeDigits(clienteFiscal?.cuit);
  const docNumberRaw = normalizeDigits(clienteFiscal?.numeroDocumento);
  const docTypeLookup = normalizeLookup(docTypeRaw);
  const mapping = {
    CUIT: 80,
    CUIL: 86,
    CDI: 87,
    DNI: 96,
    'CONSUMIDOR FINAL': 99,
    CONSUMIDOR_FINAL: 99,
    'SIN IDENTIFICAR': 99
  };

  if (docTypeLookup && /^\d+$/.test(docTypeLookup)) {
    return {
      type: Number.parseInt(docTypeLookup, 10),
      number: Number.parseInt(docNumberRaw || cuit || '0', 10)
    };
  }

  if (cuit) {
    return {
      type: 80,
      number: Number.parseInt(cuit, 10)
    };
  }

  if (docTypeLookup && mapping[docTypeLookup]) {
    return {
      type: mapping[docTypeLookup],
      number: Number.parseInt(docNumberRaw || '0', 10)
    };
  }

  if (invoiceSpec.label === 'CONSUMIDOR_FINAL') {
    return {
      type: 99,
      number: Number.parseInt(docNumberRaw || '0', 10)
    };
  }

  throw createHttpError.badRequest('Falta un documento valido para emitir el comprobante fiscal');
};

const fallbackVatConditionMap = {
  'IVA RESPONSABLE INSCRIPTO': 1,
  'RESPONSABLE INSCRIPTO': 1,
  'IVA SUJETO EXENTO': 4,
  EXENTO: 4,
  'CONSUMIDOR FINAL': 5,
  'RESPONSABLE MONOTRIBUTO': 6,
  MONOTRIBUTO: 6,
  'SUJETO NO CATEGORIZADO': 7,
  'PROVEEDOR DEL EXTERIOR': 8,
  'CLIENTE DEL EXTERIOR': 9,
  'IVA LIBERADO LEY 19640': 10,
  'MONOTRIBUTISTA SOCIAL': 13,
  'IVA NO ALCANZADO': 15,
  'MONOTRIBUTO TRABAJADOR INDEPENDIENTE PROMOVIDO': 16
};

const resolveVatCondition = async ({ ambiente, invoiceSpec, clienteFiscal }) => {
  const rawCondition = clienteFiscal?.condicionIva;
  const normalizedCondition = normalizeLookup(rawCondition);

  if (normalizedCondition && /^\d+$/.test(normalizedCondition)) {
    return {
      id: Number.parseInt(normalizedCondition, 10),
      description: rawCondition
    };
  }

  const conditions = await getReceiverVatConditions({
    ambiente,
    invoiceClass: invoiceSpec.invoiceClass
  });
  const requestedNames = [];

  if (invoiceSpec.label === 'FACTURA_A') {
    requestedNames.push('IVA RESPONSABLE INSCRIPTO');
  } else if (invoiceSpec.label === 'CONSUMIDOR_FINAL') {
    requestedNames.push('CONSUMIDOR FINAL');
  }
  if (normalizedCondition) {
    requestedNames.unshift(normalizedCondition);
  }

  const condition = conditions.find((item) => {
    const description = normalizeLookup(item.description);
    return requestedNames.some((candidate) => (
      description === candidate ||
      description.includes(candidate) ||
      candidate.includes(description)
    ));
  });

  if (condition) {
    return condition;
  }

  const fallbackId = fallbackVatConditionMap[normalizedCondition];
  if (fallbackId) {
    return {
      id: fallbackId,
      description: rawCondition
    };
  }

  throw createHttpError.badRequest('No se pudo resolver la condicion IVA del receptor para ARCA');
};

const buildIvaDetail = (alicuotaIva, impNeto, impIva) => {
  const ivaCode = DEFAULT_IVA_ALICUOTAS[alicuotaIva];

  if (!ivaCode) {
    throw createHttpError.badRequest('Alicuota de IVA no soportada para facturacion ARCA');
  }

  return `
<Iva>
  <AlicIva>
    <Id>${ivaCode}</Id>
    <BaseImp>${impNeto.toFixed(2)}</BaseImp>
    <Importe>${impIva.toFixed(2)}</Importe>
  </AlicIva>
</Iva>`;
};

const parseObservations = (xml) => {
  const observationsBlock = extractTag(xml, 'Observaciones');
  if (!observationsBlock) {
    return [];
  }

  return extractBlocks(observationsBlock, 'Obs').map((block) => ({
    code: Number.parseInt(extractTag(block, 'Code') || '', 10) || null,
    message: extractTag(block, 'Msg') || ''
  }));
};

const emitirComprobanteArca = async ({
  ambiente,
  pointOfSale,
  tipoComprobante,
  clienteFiscal,
  total,
  fechaComprobante,
  alicuotaIva = 21
}) => {
  const invoiceSpec = resolveInvoiceSpec(tipoComprobante);
  const vatRate = Number.parseFloat(alicuotaIva || 21);
  const totalAmount = roundAmount(total);

  if (totalAmount <= 0) {
    throw createHttpError.badRequest('El comprobante fiscal requiere un total mayor a cero');
  }

  const document = resolveDocumentType(clienteFiscal, invoiceSpec);
  const vatCondition = await resolveVatCondition({
    ambiente,
    invoiceSpec,
    clienteFiscal
  });
  const lastVoucher = await getLastAuthorizedVoucher({
    ambiente,
    pointOfSale,
    voucherType: invoiceSpec.code
  });
  const nextVoucherNumber = lastVoucher.number + 1;
  const issueDate = formatArcaDate(fechaComprobante ? new Date(fechaComprobante) : new Date());

  let impNeto = totalAmount;
  let impIva = 0;
  let ivaXml = '';

  if (invoiceSpec.invoiceClass !== 'C') {
    const divisor = 1 + (vatRate / 100);
    impNeto = roundAmount(totalAmount / divisor);
    impIva = roundAmount(totalAmount - impNeto);
    ivaXml = buildIvaDetail(vatRate, impNeto, impIva);
  }

  const requestPayload = {
    pointOfSale,
    voucherType: invoiceSpec.code,
    voucherNumber: nextVoucherNumber,
    issueDate,
    invoiceClass: invoiceSpec.invoiceClass,
    vatCondition,
    document,
    totals: {
      total: totalAmount,
      net: impNeto,
      vat: impIva,
      vatRate
    }
  };

  const requestXml = `
<FeCAEReq>
  <FeCabReq>
    <CantReg>1</CantReg>
    <PtoVta>${pointOfSale}</PtoVta>
    <CbteTipo>${invoiceSpec.code}</CbteTipo>
  </FeCabReq>
  <FeDetReq>
    <FECAEDetRequest>
      <Concepto>1</Concepto>
      <DocTipo>${document.type}</DocTipo>
      <DocNro>${document.number}</DocNro>
      <CbteDesde>${nextVoucherNumber}</CbteDesde>
      <CbteHasta>${nextVoucherNumber}</CbteHasta>
      <CbteFch>${issueDate}</CbteFch>
      <ImpTotal>${totalAmount.toFixed(2)}</ImpTotal>
      <ImpTotConc>0.00</ImpTotConc>
      <ImpNeto>${impNeto.toFixed(2)}</ImpNeto>
      <ImpOpEx>0.00</ImpOpEx>
      <ImpTrib>0.00</ImpTrib>
      <ImpIVA>${impIva.toFixed(2)}</ImpIVA>
      <MonId>PES</MonId>
      <MonCotiz>1.00</MonCotiz>
      <CondicionIVAReceptorId>${vatCondition.id}</CondicionIVAReceptorId>
      ${ivaXml}
    </FECAEDetRequest>
  </FeDetReq>
</FeCAEReq>`;

  const result = await callWsfe({
    ambiente,
    method: 'FECAESolicitar',
    bodyXml: requestXml
  });
  const detailXml = extractBlocks(extractTag(result.resultXml, 'FeDetResp'), 'FECAEDetResponse')[0] || '';
  const responseErrors = [
    ...result.errors,
    ...parseCodeMessages(detailXml, 'Errors', 'Err')
  ];
  const observations = parseObservations(detailXml);
  const resultCode = extractTag(detailXml, 'Resultado') || (extractTag(detailXml, 'CAE') ? 'A' : null);

  if (responseErrors.length > 0 || resultCode === 'R') {
    throw new ArcaServiceError(
      responseErrors.map((item) => item.message).join(' | ') || 'ARCA rechazo la solicitud del comprobante',
      {
        code: 'ARCA_REJECTED',
        status: 400,
        details: responseErrors,
        events: result.events,
        responseXml: result.responseXml,
        requestPayload
      }
    );
  }

  const cae = extractTag(detailXml, 'CAE');
  const caeExpirationRaw = extractTag(detailXml, 'CAEFchVto');

  if (!cae || !caeExpirationRaw) {
    throw new ArcaServiceError('ARCA no devolvio CAE para el comprobante solicitado', {
      code: 'ARCA_INVALID_CAE',
      status: 502,
      details: responseErrors,
      events: result.events,
      responseXml: result.responseXml,
      requestPayload
    });
  }

  return {
    cae,
    caeExpirationDate: parseArcaDate(caeExpirationRaw),
    voucherNumber: nextVoucherNumber,
    invoiceClass: invoiceSpec.invoiceClass,
    voucherType: invoiceSpec.code,
    numeroComprobante: formatComprobanteNumber(pointOfSale, nextVoucherNumber),
    vatCondition,
    document,
    observations,
    events: result.events,
    requestPayload,
    responseSummary: {
      resultado: resultCode,
      cae,
      caeExpirationRaw,
      events: result.events,
      observations
    },
    responseXml: result.responseXml
  };
};

module.exports = {
  ArcaServiceError,
  DEFAULT_IVA_ALICUOTAS,
  WSAA_SERVICE_ID,
  formatComprobanteNumber,
  getAccessTicket,
  getReceiverVatConditions,
  hasArcaRuntimeConfig,
  emitirComprobanteArca
};
