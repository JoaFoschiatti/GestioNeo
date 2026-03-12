const fs = require('fs');
const os = require('os');
const path = require('path');

const MIN_JWT_SECRET_LENGTH = 32;
const ENCRYPTION_KEY_REGEX = /^[a-fA-F0-9]{64}$/;
const REQUIRED_PRODUCTION_VARS = [
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_SECRET',
  'FRONTEND_URL',
  'BACKEND_URL',
  'ENCRYPTION_KEY',
  'MERCADOPAGO_WEBHOOK_SECRET',
  'BRIDGE_TOKEN'
];

const getBackendRoot = (rootDir = path.resolve(__dirname, '../..')) => rootDir;

const getRuntimePaths = (rootDir = getBackendRoot()) => ({
  backendRoot: rootDir,
  logsDir: path.join(rootDir, 'logs'),
  uploadsDir: path.join(rootDir, 'uploads')
});

const validateUrls = (value, key, errors) => {
  const urls = String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (urls.length === 0) {
    errors.push(`${key} debe contener al menos una URL valida`);
    return;
  }

  urls.forEach((url) => {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        errors.push(`${key} contiene un protocolo invalido: ${url}`);
      }
    } catch {
      errors.push(`${key} contiene una URL invalida: ${url}`);
    }
  });
};

const validateArcaConfig = (env, errors) => {
  const requiredArcaVars = ['ARCA_CUIT', 'ARCA_CERT_PATH', 'ARCA_KEY_PATH'];
  const configuredArcaVars = requiredArcaVars.filter((key) => Boolean(env[key]));

  if (configuredArcaVars.length === 0) {
    return;
  }

  requiredArcaVars
    .filter((key) => !env[key])
    .forEach((key) => errors.push(`Falta ${key} para habilitar ARCA en produccion`));

  const ambiente = env.ARCA_AMBIENTE || 'homologacion';
  if (!['homologacion', 'produccion'].includes(ambiente)) {
    errors.push('ARCA_AMBIENTE debe ser homologacion o produccion');
  }
};

const validateProductionEnvironment = (env = process.env) => {
  if (env.NODE_ENV !== 'production') {
    return {
      mode: env.NODE_ENV || 'development',
      validated: false
    };
  }

  const errors = [];

  REQUIRED_PRODUCTION_VARS
    .filter((key) => !env[key])
    .forEach((key) => errors.push(`Falta ${key} en produccion`));

  if (env.JWT_SECRET && String(env.JWT_SECRET).length < MIN_JWT_SECRET_LENGTH) {
    errors.push(`JWT_SECRET debe tener al menos ${MIN_JWT_SECRET_LENGTH} caracteres`);
  }

  if (env.ENCRYPTION_KEY && !ENCRYPTION_KEY_REGEX.test(env.ENCRYPTION_KEY)) {
    errors.push('ENCRYPTION_KEY debe tener 64 caracteres hexadecimales');
  }

  if (env.ENCRYPTION_KEY && /^0+$/.test(env.ENCRYPTION_KEY)) {
    errors.push('ENCRYPTION_KEY no puede ser el placeholder por defecto (todos ceros). Genera una clave segura con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }

  if (env.BRIDGE_TOKEN && String(env.BRIDGE_TOKEN).trim().length < 16) {
    errors.push('BRIDGE_TOKEN debe tener al menos 16 caracteres');
  }

  if (env.FRONTEND_URL) {
    validateUrls(env.FRONTEND_URL, 'FRONTEND_URL', errors);
  }

  if (env.BACKEND_URL) {
    validateUrls(env.BACKEND_URL, 'BACKEND_URL', errors);
  }

  validateArcaConfig(env, errors);

  if (errors.length > 0) {
    throw new Error(`Configuracion invalida de produccion:\n- ${errors.join(`\n- `)}`);
  }

  return {
    mode: 'production',
    validated: true
  };
};

const ensureDirectory = (directoryPath) => {
  fs.mkdirSync(directoryPath, { recursive: true });
  return directoryPath;
};

const assertWritableDirectory = (directoryPath) => {
  ensureDirectory(directoryPath);
  const probePath = path.join(
    directoryPath,
    `.runtime-check-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  fs.writeFileSync(probePath, os.hostname(), 'utf8');
  fs.unlinkSync(probePath);
  return directoryPath;
};

const ensureRuntimeDirectories = (runtimePaths = getRuntimePaths()) => {
  assertWritableDirectory(runtimePaths.logsDir);
  assertWritableDirectory(runtimePaths.uploadsDir);
  return runtimePaths;
};

module.exports = {
  MIN_JWT_SECRET_LENGTH,
  ENCRYPTION_KEY_REGEX,
  REQUIRED_PRODUCTION_VARS,
  getBackendRoot,
  getRuntimePaths,
  validateProductionEnvironment,
  ensureDirectory,
  assertWritableDirectory,
  ensureRuntimeDirectories
};
