# Variables de Entorno - Comanda Backend

Guía completa de configuración de variables de entorno para Comanda.

## 📋 Índice

- [Variables Requeridas](#variables-requeridas)
- [Variables Opcionales](#variables-opcionales)
- [Generación de Secrets](#generación-de-secrets)
- [Configuración por Ambiente](#configuración-por-ambiente)
- [Validación](#validación)

---

## Variables Requeridas

### 🔴 Críticas (NO deployar sin estas)

#### `DATABASE_URL`
**Descripción:** URL de conexión a PostgreSQL (con pooling si aplica)
**Formato:** `postgresql://usuario:password@host:puerto/database?opciones`
**Ejemplo desarrollo:** `postgresql://postgres:postgres@localhost:5432/comanda`
**Ejemplo Supabase:** `postgresql://postgres.xxxxx:PASSWORD@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true`

#### `DIRECT_URL`
**Descripción:** URL de conexión directa (sin pooling) para migraciones
**Formato:** Mismo que DATABASE_URL pero puerto 5432
**Ejemplo Supabase:** `postgresql://postgres.xxxxx:PASSWORD@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`

#### `JWT_SECRET`
**Descripción:** Secret para firmar tokens JWT
**Requisitos:** Mínimo 32 caracteres, aleatorio
**Generar:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
**Ejemplo:** `X9k2mP7qR4vT8wY1nL5jH3sD6fG9bN0c`

#### `ENCRYPTION_KEY`
**Descripción:** Clave AES-256 para encriptar credenciales de MercadoPago
**Requisitos:** Exactamente 64 caracteres hexadecimales (32 bytes)
**Generar:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
**Ejemplo:** `a1b2c3d4e5f6...` (64 chars)

#### `FRONTEND_URL`
**Descripción:** URL(s) del frontend para CORS
**Formato:** URL completa con protocolo, sin trailing slash
**Múltiples:** Separar con comas
**Ejemplos:**
- Desarrollo: `http://localhost:5173`
- Producción: `https://mirestaurante.com`
- Múltiples: `https://mirestaurante.com,https://www.mirestaurante.com`

**⚠️ IMPORTANTE:** En `NODE_ENV=production`, la app fallará al iniciar si esta variable no está configurada.

---

### 🟡 Importantes (requeridas para funcionalidad completa)

#### `MERCADOPAGO_WEBHOOK_SECRET`
**Descripción:** Secret para verificar firma de webhooks de MercadoPago
**Dónde obtener:** Panel de MercadoPago → Tu aplicación → Webhooks → Secret
**Formato:** String provisto por MercadoPago
**Ejemplo:** `1234567890abcdef`

**⚠️ SEGURIDAD:** Sin esto, los webhooks NO se verificarán y la app es vulnerable a webhooks falsos.

#### `MP_APP_ID` y `MP_APP_SECRET`
**Descripción:** Credenciales de aplicación MercadoPago para OAuth
**Dónde obtener:** https://www.mercadopago.com.ar/developers/panel/app
**Uso:** Conectar cuentas de MercadoPago de cada tenant (restaurante)

#### `BRIDGE_TOKEN`
**Descripción:** Token de autenticación para el servicio de impresión local
**Requisitos:** String aleatorio
**Generar:**
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"
```

---

## Variables Opcionales

### Servidor

#### `PORT`
**Default:** `3001`
**Descripción:** Puerto donde corre el servidor Express

#### `NODE_ENV`
**Valores:** `development` | `production` | `test`
**Default:** `development`
**Descripción:** Ambiente de ejecución

### MercadoPago (Legacy)

#### `MERCADOPAGO_ACCESS_TOKEN`
**Descripción:** Token global (deprecated - usar OAuth por tenant)
**Uso:** Fallback para tenants sin configuración propia

#### `MERCADOPAGO_PUBLIC_KEY`
**Descripción:** Public key global
**Uso:** Frontend (deprecated)

### Email (Opcional)

#### `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
**Descripción:** Configuración SMTP para envío de emails
**Uso:** Notificaciones de pedidos, confirmaciones

#### `EMAIL_FROM`
**Descripción:** Email remitente
**Ejemplo:** `noreply@turestaurante.com`

### Impresión

#### `PRINT_WIDTH_MM`
**Default:** `80`
**Descripción:** Ancho del papel de impresora térmica (mm)

#### `PRINT_MAX_RETRIES`
**Default:** `3`
**Descripción:** Intentos máximos de reimpresión

#### `PRINT_BACKOFF_MS`
**Default:** `2000`
**Descripción:** Tiempo de espera entre reintentos (ms)

#### `PRINT_CLAIM_TTL_MS`
**Default:** `60000`
**Descripción:** TTL de claim de trabajos de impresión (ms)

### Desarrollo

#### `SKIP_WEBHOOK_VERIFICATION`
**Valores:** `true` | `false` (omitir = false)
**Descripción:** Deshabilita verificación de webhooks
**⚠️ NUNCA usar en producción**

---

## Generación de Secrets

### Script Completo

Crear archivo `generate-secrets.js`:

```javascript
const crypto = require('crypto');

console.log('=== SECRETS PARA GESTIONEO ===\n');

console.log('JWT_SECRET (32 bytes base64):');
console.log(crypto.randomBytes(32).toString('base64'));
console.log('');

console.log('ENCRYPTION_KEY (32 bytes hex):');
console.log(crypto.randomBytes(32).toString('hex'));
console.log('');

console.log('BRIDGE_TOKEN (16 bytes base64):');
console.log(crypto.randomBytes(16).toString('base64'));
console.log('');

console.log('⚠️  Copiar estos valores a .env y NUNCA commitearlos a git');
```

Ejecutar:
```bash
node generate-secrets.js
```

---

## Configuración por Ambiente

### Desarrollo Local

```env
NODE_ENV=development
PORT=3001

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/comanda"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/comanda"

JWT_SECRET=dev_secret_change_in_production
JWT_EXPIRES_IN=24h

ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000

FRONTEND_URL=http://localhost:5173

BRIDGE_TOKEN=dev_bridge_token

# MercadoPago en modo TEST
MERCADOPAGO_ACCESS_TOKEN=TEST-xxxx
MP_APP_ID=your_test_app_id
MP_APP_SECRET=your_test_app_secret
MERCADOPAGO_WEBHOOK_SECRET=test_webhook_secret

# Opcional: deshabilitar verificación en desarrollo
SKIP_WEBHOOK_VERIFICATION=true
```

### Staging

```env
NODE_ENV=production
PORT=3001

DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

JWT_SECRET=[USAR SECRET GENERADO]
JWT_EXPIRES_IN=24h

ENCRYPTION_KEY=[USAR KEY GENERADA]

FRONTEND_URL=https://staging.mirestaurante.com

BRIDGE_TOKEN=[USAR TOKEN GENERADO]

# MercadoPago en modo TEST (staging)
MP_APP_ID=your_test_app_id
MP_APP_SECRET=your_test_app_secret
MERCADOPAGO_WEBHOOK_SECRET=your_webhook_secret
```

### Producción

```env
NODE_ENV=production
PORT=3001

DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

JWT_SECRET=[SECRET ÚNICO Y SEGURO]
JWT_EXPIRES_IN=24h

ENCRYPTION_KEY=[KEY ÚNICA Y SEGURA]

FRONTEND_URL=https://mirestaurante.com,https://www.mirestaurante.com

BRIDGE_TOKEN=[TOKEN ÚNICO Y SEGURO]

# MercadoPago en modo PRODUCCIÓN
MP_APP_ID=your_production_app_id
MP_APP_SECRET=your_production_app_secret
MERCADOPAGO_WEBHOOK_SECRET=your_production_webhook_secret

# Email configurado
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@mirestaurante.com
SMTP_PASS=[APP PASSWORD]
EMAIL_FROM=noreply@mirestaurante.com
```

---

## Validación

### Checklist Pre-Deployment

Antes de deployar a producción, verificar:

- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` es un valor aleatorio (NO el default)
- [ ] `ENCRYPTION_KEY` tiene exactamente 64 caracteres hex
- [ ] `FRONTEND_URL` apunta al dominio de producción
- [ ] `MERCADOPAGO_WEBHOOK_SECRET` está configurado
- [ ] `MP_APP_ID` y `MP_APP_SECRET` son de producción (no TEST)
- [ ] `DATABASE_URL` apunta a base de datos de producción
- [ ] Archivo `.env` NO está commiteado a git
- [ ] Variables secretas están en gestor de secrets (AWS Secrets Manager, Railway, etc.)

### Script de Validación

Crear `validate-env.js`:

```javascript
const required = [
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'FRONTEND_URL'
];

const production = [
  'MERCADOPAGO_WEBHOOK_SECRET',
  'MP_APP_ID',
  'MP_APP_SECRET'
];

let errors = [];

// Check required
required.forEach(key => {
  if (!process.env[key]) {
    errors.push(`❌ ${key} is required`);
  }
});

// Check production-specific
if (process.env.NODE_ENV === 'production') {
  production.forEach(key => {
    if (!process.env[key]) {
      errors.push(`❌ ${key} is required in production`);
    }
  });

  // Validate secrets are not defaults
  if (process.env.JWT_SECRET?.includes('CHANGE_THIS')) {
    errors.push('❌ JWT_SECRET must be changed from default');
  }

  if (process.env.ENCRYPTION_KEY === '0'.repeat(64)) {
    errors.push('❌ ENCRYPTION_KEY must be changed from default');
  }

  if (!process.env.FRONTEND_URL.startsWith('https://')) {
    errors.push('⚠️  FRONTEND_URL should use HTTPS in production');
  }
}

// Validate ENCRYPTION_KEY format
if (process.env.ENCRYPTION_KEY) {
  if (!/^[0-9a-f]{64}$/i.test(process.env.ENCRYPTION_KEY)) {
    errors.push('❌ ENCRYPTION_KEY must be exactly 64 hexadecimal characters');
  }
}

if (errors.length > 0) {
  console.error('\n🚨 Environment validation failed:\n');
  errors.forEach(err => console.error(err));
  console.error('');
  process.exit(1);
}

console.log('✅ Environment variables validated successfully');
```

Ejecutar:
```bash
node validate-env.js
```

---

## Gestión de Secrets en Producción

### Railway

```bash
railway variables set JWT_SECRET="valor_secreto"
railway variables set ENCRYPTION_KEY="valor_secreto"
```

### Vercel

```bash
vercel env add JWT_SECRET production
vercel env add ENCRYPTION_KEY production
```

### AWS Secrets Manager

```bash
aws secretsmanager create-secret \
  --name comanda/production/jwt \
  --secret-string "valor_secreto"
```

### Docker

```yaml
# docker-compose.yml
services:
  backend:
    env_file:
      - .env.production
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
```

---

## Troubleshooting

### Error: "FRONTEND_URL must be set in production"
**Causa:** Variable `FRONTEND_URL` no configurada en producción
**Solución:** Configurar la variable con la URL del frontend

### Error: "MERCADOPAGO_WEBHOOK_SECRET no configurado"
**Causa:** Variable no configurada, webhooks sin verificar
**Solución:** Obtener secret del panel de MercadoPago y configurarlo

### Error: "ENCRYPTION_KEY must be exactly 64 hexadecimal characters"
**Causa:** Key mal formateada
**Solución:** Generar nueva key con `crypto.randomBytes(32).toString('hex')`

### Webhooks de MercadoPago son rechazados con 401
**Causa:** Secret incorrecto o no configurado
**Solución:** Verificar que `MERCADOPAGO_WEBHOOK_SECRET` coincida con el del panel

---

## Seguridad

### ⚠️ NUNCA

- ❌ Commitear archivo `.env` a git
- ❌ Compartir secrets en Slack/email/mensajes
- ❌ Usar valores por defecto en producción
- ❌ Deployar con `SKIP_WEBHOOK_VERIFICATION=true`
- ❌ Reusar secrets entre ambientes (dev/staging/prod)

### ✅ SIEMPRE

- ✅ Rotar secrets periódicamente (cada 90 días)
- ✅ Usar gestor de secrets (AWS/Railway/Vercel)
- ✅ Validar variables antes de deploy
- ✅ Usar HTTPS en producción
- ✅ Mantener backups encriptados de secrets

---

## Soporte

Para más información, revisar:
- [Deployment Guide](../DEPLOY.md)
- [Security Guide](./SECURITY.md)
- [Architecture](./ARCHITECTURE.md)
