const {
  encrypt,
  decrypt,
  generateEncryptionKey,
  isValidEncryptionKey
} = require('../services/crypto.service');

describe('crypto.service', () => {
  const originalKey = process.env.ENCRYPTION_KEY;

  afterEach(() => {
    if (originalKey) {
      process.env.ENCRYPTION_KEY = originalKey;
    } else {
      delete process.env.ENCRYPTION_KEY;
    }
  });

  it('genera una clave valida', () => {
    const key = generateEncryptionKey();
    expect(isValidEncryptionKey(key)).toBe(true);
  });

  it('encripta y desencripta correctamente', () => {
    process.env.ENCRYPTION_KEY = generateEncryptionKey();
    const encrypted = encrypt('token-secreto');

    expect(encrypted).not.toBe('token-secreto');
    expect(decrypt(encrypted)).toBe('token-secreto');
  });

  it('rechaza datos encriptados con formato invalido', () => {
    process.env.ENCRYPTION_KEY = generateEncryptionKey();
    expect(() => decrypt('invalido')).toThrow('Formato de datos encriptados inválido');
  });

  it('falla si no existe ENCRYPTION_KEY', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt('token')).toThrow('ENCRYPTION_KEY no está configurada');
  });

  it('falla si ENCRYPTION_KEY no es valida', () => {
    process.env.ENCRYPTION_KEY = 'no-valida';
    expect(() => encrypt('token')).toThrow('ENCRYPTION_KEY debe ser de 64 caracteres hexadecimales');
  });
});
