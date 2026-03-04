const dotenv = require('dotenv');

dotenv.config({ quiet: true });

const forceIpv4Localhost = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;

  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname === 'localhost') {
      parsed.hostname = '127.0.0.1';
      return parsed.toString();
    }
  } catch {
    // fall through to naive replacement
  }

  return rawUrl.replace('@localhost', '@127.0.0.1');
};

process.env.NODE_ENV = 'test';

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = forceIpv4Localhost(process.env.DATABASE_URL);
}

if (process.env.DIRECT_URL) {
  process.env.DIRECT_URL = forceIpv4Localhost(process.env.DIRECT_URL);
}

if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'test-secret';
if (!process.env.JWT_EXPIRES_IN) process.env.JWT_EXPIRES_IN = '1h';

