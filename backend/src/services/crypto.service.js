/**
 * Servicio de encriptación para credenciales sensibles
 * Usa AES-256-GCM para encriptar tokens de MercadoPago antes de guardarlos en DB
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Obtiene la clave de encriptación del entorno
 * La clave debe ser de 32 bytes (64 caracteres hex)
 */
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error('ENCRYPTION_KEY no está configurada en las variables de entorno');
  }

  if (!isValidEncryptionKey(key)) {
    throw new Error('ENCRYPTION_KEY debe ser de 64 caracteres hexadecimales (32 bytes)');
  }

  return Buffer.from(key, 'hex');
}

/**
 * Encripta un texto usando AES-256-GCM
 * @param {string} text - Texto a encriptar
 * @returns {string} - Texto encriptado en formato "iv:authTag:encrypted"
 */
function encrypt(text) {
  if (!text) {
    throw new Error('No se puede encriptar un valor vacío');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Formato: iv:authTag:encrypted (todo en hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Desencripta un texto encriptado con encrypt()
 * @param {string} encryptedData - Texto encriptado en formato "iv:authTag:encrypted"
 * @returns {string} - Texto original
 */
function decrypt(encryptedData) {
  if (!encryptedData) {
    throw new Error('No se puede desencriptar un valor vacío');
  }

  const parts = encryptedData.split(':');

  if (parts.length !== 3) {
    throw new Error('Formato de datos encriptados inválido');
  }

  const [ivHex, authTagHex, encrypted] = parts;

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Genera una clave de encriptación aleatoria (para setup inicial)
 * @returns {string} - Clave de 64 caracteres hex
 */
function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Verifica si una clave de encriptación es válida
 * @param {string} key - Clave a verificar
 * @returns {boolean}
 */
function isValidEncryptionKey(key) {
  if (!key || typeof key !== 'string') return false;
  if (key.length !== 64) return false;
  return /^[0-9a-fA-F]+$/.test(key);
}

module.exports = {
  encrypt,
  decrypt,
  generateEncryptionKey,
  isValidEncryptionKey
};
