# Plan: Configuración de MercadoPago por Tenant para Menú Público

**Generated**: 2026-01-20
**Estimated Complexity**: Medium-High
**Tech Stack**: Node.js/Express, React, Prisma/PostgreSQL, MercadoPago SDK

## Overview

Este plan implementa la funcionalidad para que cada dueño de restaurante (tenant) pueda configurar su propia cuenta de MercadoPago y recibir pagos directamente cuando los clientes hacen pedidos desde el menú público (`/menu/:slug`).

**Situación actual:**
- El sistema usa una única configuración global de MercadoPago (`MERCADOPAGO_ACCESS_TOKEN` en `.env`)
- Los tenants solo pueden habilitar/deshabilitar MercadoPago via checkbox
- No hay forma de que cada tenant conecte su propia cuenta

**Solución propuesta:**
- Implementar **OAuth de MercadoPago** para conexión fácil con botón "Conectar con MercadoPago"
- Agregar opción de **configuración manual** de credenciales como fallback
- Almacenar credenciales encriptadas por tenant en la base de datos
- Mostrar **historial de transacciones** en el panel admin
- Si un tenant no tiene MP configurado, solo acepta efectivo/pago presencial

## Prerequisites

- [ ] Crear aplicación en MercadoPago Developers (https://www.mercadopago.com.ar/developers)
- [ ] Obtener `APP_ID` y `APP_SECRET` para OAuth
- [ ] Configurar redirect URI: `{BACKEND_URL}/api/mercadopago/oauth/callback`
- [ ] Instalar dependencia para encriptación de credenciales
- [ ] Configurar variables de entorno para OAuth de la plataforma

## Phase 1: Base de Datos y Modelos
**Goal**: Extender el esquema de Prisma para almacenar credenciales de MercadoPago por tenant

### Task 1.1: Crear modelo MercadoPagoConfig en Prisma
- **Location**: `backend/prisma/schema.prisma`
- **Description**: Agregar modelo para almacenar credenciales de MP por tenant con campos encriptados
- **Dependencies**: None
- **Complexity**: 3
- **Test-First Approach**:
  - Write test: Test unitario que verifique que el modelo se crea correctamente con todos los campos
  - Test verifies: Campos requeridos, relación con Tenant, unicidad de tenantId
- **Implementation Details**:
  ```prisma
  model MercadoPagoConfig {
    id              Int      @id @default(autoincrement())
    tenantId        Int      @unique
    accessToken     String   // Encriptado
    refreshToken    String?  // Encriptado (para OAuth)
    publicKey       String?
    userId          String?  // ID del usuario en MP
    email           String?  // Email de la cuenta MP
    expiresAt       DateTime?
    isOAuth         Boolean  @default(false)
    isActive        Boolean  @default(true)
    createdAt       DateTime @default(now())
    updatedAt       DateTime @updatedAt

    tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

    @@map("mercadopago_configs")
  }
  ```
  - Agregar relación en modelo Tenant: `mercadoPagoConfig MercadoPagoConfig?`
- **Acceptance Criteria**:
  - [ ] Modelo creado con todos los campos especificados
  - [ ] Relación 1:1 con Tenant establecida
  - [ ] Índice único en tenantId

### Task 1.2: Crear modelo TransaccionMercadoPago para historial
- **Location**: `backend/prisma/schema.prisma`
- **Description**: Modelo para almacenar historial de transacciones de MercadoPago por tenant
- **Dependencies**: Task 1.1
- **Complexity**: 2
- **Test-First Approach**:
  - Write test: Verificar que se pueden crear transacciones asociadas a pagos
  - Test verifies: Relación con Pago y Tenant, campos de auditoría
- **Implementation Details**:
  ```prisma
  model TransaccionMercadoPago {
    id                Int         @id @default(autoincrement())
    tenantId          Int
    pagoId            Int?
    mpPaymentId       String      @unique
    mpPreferenceId    String?
    status            String      // approved, rejected, pending, etc.
    statusDetail      String?
    amount            Decimal     @db.Decimal(10, 2)
    currency          String      @default("ARS")
    payerEmail        String?
    paymentMethod     String?     // credit_card, debit_card, account_money, etc.
    paymentTypeId     String?     // visa, mastercard, etc.
    installments      Int?
    fee               Decimal?    @db.Decimal(10, 2) // Comisión de MP
    netAmount         Decimal?    @db.Decimal(10, 2) // Monto neto recibido
    externalReference String?
    rawData           Json?       // Guardar respuesta completa de MP
    createdAt         DateTime    @default(now())

    tenant            Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
    pago              Pago?       @relation(fields: [pagoId], references: [id])

    @@index([tenantId])
    @@index([tenantId, createdAt])
    @@map("transacciones_mercadopago")
  }
  ```
- **Acceptance Criteria**:
  - [ ] Modelo creado con campos para tracking completo
  - [ ] Relación opcional con Pago para vincular con pedidos
  - [ ] Campo rawData para debugging

### Task 1.3: Ejecutar migración de Prisma
- **Location**: `backend/prisma/`
- **Description**: Generar y ejecutar migración para los nuevos modelos
- **Dependencies**: Task 1.1, Task 1.2
- **Complexity**: 1
- **Implementation Details**:
  ```bash
  cd backend
  npx prisma migrate dev --name add_mercadopago_tenant_config
  npx prisma generate
  ```
- **Acceptance Criteria**:
  - [ ] Migración ejecutada sin errores
  - [ ] Cliente Prisma regenerado

## Phase 2: Servicio de Encriptación y MercadoPago
**Goal**: Crear servicios para manejar encriptación de credenciales y lógica de MercadoPago multi-tenant

### Task 2.1: Crear servicio de encriptación
- **Location**: `backend/src/services/crypto.service.js`
- **Description**: Servicio para encriptar/desencriptar credenciales sensibles usando AES-256
- **Dependencies**: None
- **Complexity**: 4
- **Test-First Approach**:
  - Write test: Tests para encriptar, desencriptar, y verificar que datos encriptados no son legibles
  - Test verifies: Encriptación reversible, diferentes resultados con misma entrada (IV random)
- **Implementation Details**:
  ```javascript
  const crypto = require('crypto');

  const ALGORITHM = 'aes-256-gcm';
  const KEY = process.env.ENCRYPTION_KEY; // 32 bytes

  function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(KEY, 'hex'), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  function decrypt(encryptedData) {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(KEY, 'hex'), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  module.exports = { encrypt, decrypt };
  ```
- **Acceptance Criteria**:
  - [ ] Encriptación AES-256-GCM implementada
  - [ ] Funciones encrypt/decrypt exportadas
  - [ ] Tests unitarios pasando

### Task 2.2: Crear servicio de MercadoPago multi-tenant
- **Location**: `backend/src/services/mercadopago.service.js`
- **Description**: Servicio centralizado para operaciones de MercadoPago que obtiene credenciales del tenant
- **Dependencies**: Task 1.3, Task 2.1
- **Complexity**: 6
- **Test-First Approach**:
  - Write test: Mock de Prisma para verificar obtención de credenciales y creación de cliente MP
  - Test verifies: Obtención correcta de access token, manejo de tenant sin configuración
- **Implementation Details**:
  ```javascript
  const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
  const { prisma } = require('../db/prisma');
  const { decrypt } = require('./crypto.service');

  async function getMercadoPagoClient(tenantId) {
    const config = await prisma.mercadoPagoConfig.findUnique({
      where: { tenantId }
    });

    if (!config || !config.isActive) {
      return null;
    }

    const accessToken = decrypt(config.accessToken);
    return new MercadoPagoConfig({ accessToken });
  }

  async function createPreference(tenantId, preferenceData) {
    const client = await getMercadoPagoClient(tenantId);
    if (!client) throw new Error('MercadoPago no configurado para este tenant');

    const preference = new Preference(client);
    return preference.create({ body: preferenceData });
  }

  async function getPayment(tenantId, paymentId) {
    const client = await getMercadoPagoClient(tenantId);
    if (!client) throw new Error('MercadoPago no configurado para este tenant');

    const payment = new Payment(client);
    return payment.get({ id: paymentId });
  }

  async function isMercadoPagoConfigured(tenantId) {
    const config = await prisma.mercadoPagoConfig.findUnique({
      where: { tenantId }
    });
    return config?.isActive ?? false;
  }

  module.exports = {
    getMercadoPagoClient,
    createPreference,
    getPayment,
    isMercadoPagoConfigured
  };
  ```
- **Acceptance Criteria**:
  - [ ] Cliente MP se crea con credenciales del tenant
  - [ ] Retorna null si tenant no tiene configuración
  - [ ] Funciones para crear preferencia y obtener pago

## Phase 3: OAuth de MercadoPago
**Goal**: Implementar flujo OAuth para que tenants conecten su cuenta con un botón

### Task 3.1: Crear controlador de OAuth de MercadoPago
- **Location**: `backend/src/controllers/mercadopago-oauth.controller.js`
- **Description**: Endpoints para iniciar y completar flujo OAuth de MercadoPago
- **Dependencies**: Task 2.1, Task 2.2
- **Complexity**: 7
- **Test-First Approach**:
  - Write test: Mock de llamadas a MP y verificar que credenciales se guardan encriptadas
  - Test verifies: Generación de URL OAuth, intercambio de código por tokens, almacenamiento seguro
- **Implementation Details**:
  ```javascript
  const { prisma } = require('../db/prisma');
  const { encrypt } = require('../services/crypto.service');

  // GET /api/mercadopago/oauth/authorize
  const iniciarOAuth = async (req, res) => {
    const tenantId = req.tenantId;
    const state = Buffer.from(JSON.stringify({ tenantId })).toString('base64');

    const authUrl = `https://auth.mercadopago.com/authorization?` +
      `client_id=${process.env.MP_APP_ID}&` +
      `response_type=code&` +
      `platform_id=mp&` +
      `state=${state}&` +
      `redirect_uri=${process.env.BACKEND_URL}/api/mercadopago/oauth/callback`;

    res.json({ authUrl });
  };

  // GET /api/mercadopago/oauth/callback
  const callbackOAuth = async (req, res) => {
    const { code, state } = req.query;
    const { tenantId } = JSON.parse(Buffer.from(state, 'base64').toString());

    // Intercambiar código por tokens
    const response = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.MP_APP_ID,
        client_secret: process.env.MP_APP_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.BACKEND_URL}/api/mercadopago/oauth/callback`
      })
    });

    const data = await response.json();

    // Guardar tokens encriptados
    await prisma.mercadoPagoConfig.upsert({
      where: { tenantId },
      update: {
        accessToken: encrypt(data.access_token),
        refreshToken: data.refresh_token ? encrypt(data.refresh_token) : null,
        publicKey: data.public_key,
        userId: data.user_id?.toString(),
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        isOAuth: true,
        isActive: true
      },
      create: {
        tenantId,
        accessToken: encrypt(data.access_token),
        refreshToken: data.refresh_token ? encrypt(data.refresh_token) : null,
        publicKey: data.public_key,
        userId: data.user_id?.toString(),
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        isOAuth: true,
        isActive: true
      }
    });

    // Habilitar MP en configuración del tenant
    await prisma.configuracion.upsert({
      where: { tenantId_clave: { tenantId, clave: 'mercadopago_enabled' } },
      update: { valor: 'true' },
      create: { tenantId, clave: 'mercadopago_enabled', valor: 'true' }
    });

    // Redirigir al frontend con éxito
    res.redirect(`${process.env.FRONTEND_URL}/admin/configuracion?mp=connected`);
  };

  // DELETE /api/mercadopago/oauth/disconnect
  const desconectarOAuth = async (req, res) => {
    const tenantId = req.tenantId;

    await prisma.mercadoPagoConfig.update({
      where: { tenantId },
      data: { isActive: false }
    });

    await prisma.configuracion.upsert({
      where: { tenantId_clave: { tenantId, clave: 'mercadopago_enabled' } },
      update: { valor: 'false' },
      create: { tenantId, clave: 'mercadopago_enabled', valor: 'false' }
    });

    res.json({ message: 'MercadoPago desconectado' });
  };

  module.exports = { iniciarOAuth, callbackOAuth, desconectarOAuth };
  ```
- **Acceptance Criteria**:
  - [ ] Endpoint genera URL de autorización correcta
  - [ ] Callback intercambia código por tokens
  - [ ] Tokens se guardan encriptados
  - [ ] Redirect al frontend después de conexión exitosa

### Task 3.2: Crear rutas de OAuth
- **Location**: `backend/src/routes/mercadopago.routes.js`
- **Description**: Definir rutas para el flujo OAuth
- **Dependencies**: Task 3.1
- **Complexity**: 2
- **Implementation Details**:
  ```javascript
  const express = require('express');
  const router = express.Router();
  const { auth, requireRol } = require('../middlewares/auth.middleware');
  const { tenantMiddleware } = require('../middlewares/tenant.middleware');
  const controller = require('../controllers/mercadopago-oauth.controller');

  // Rutas protegidas (requieren admin)
  router.get('/oauth/authorize', auth, requireRol('ADMIN'), tenantMiddleware, controller.iniciarOAuth);
  router.delete('/oauth/disconnect', auth, requireRol('ADMIN'), tenantMiddleware, controller.desconectarOAuth);
  router.get('/oauth/status', auth, requireRol('ADMIN'), tenantMiddleware, controller.obtenerEstado);

  // Callback público (viene de MercadoPago)
  router.get('/oauth/callback', controller.callbackOAuth);

  module.exports = router;
  ```
- **Acceptance Criteria**:
  - [ ] Rutas protegidas con autenticación
  - [ ] Callback accesible públicamente
  - [ ] Registradas en app.js

### Task 3.3: Agregar endpoint para configuración manual
- **Location**: `backend/src/controllers/mercadopago-oauth.controller.js`
- **Description**: Endpoint para que admins ingresen credenciales manualmente
- **Dependencies**: Task 3.1
- **Complexity**: 4
- **Implementation Details**:
  ```javascript
  // POST /api/mercadopago/config/manual
  const configurarManual = async (req, res) => {
    const tenantId = req.tenantId;
    const { accessToken, publicKey } = req.body;

    if (!accessToken) {
      return res.status(400).json({ error: { message: 'Access Token es requerido' } });
    }

    // Verificar que el token es válido consultando a MP
    try {
      const { MercadoPagoConfig, User } = require('mercadopago');
      const client = new MercadoPagoConfig({ accessToken });
      // Intentar obtener info del usuario para validar token
      const userInfo = await fetch('https://api.mercadopago.com/users/me', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }).then(r => r.json());

      if (userInfo.error) {
        return res.status(400).json({ error: { message: 'Access Token inválido' } });
      }

      await prisma.mercadoPagoConfig.upsert({
        where: { tenantId },
        update: {
          accessToken: encrypt(accessToken),
          publicKey,
          userId: userInfo.id?.toString(),
          email: userInfo.email,
          isOAuth: false,
          isActive: true
        },
        create: {
          tenantId,
          accessToken: encrypt(accessToken),
          publicKey,
          userId: userInfo.id?.toString(),
          email: userInfo.email,
          isOAuth: false,
          isActive: true
        }
      });

      await prisma.configuracion.upsert({
        where: { tenantId_clave: { tenantId, clave: 'mercadopago_enabled' } },
        update: { valor: 'true' },
        create: { tenantId, clave: 'mercadopago_enabled', valor: 'true' }
      });

      res.json({ message: 'MercadoPago configurado correctamente', email: userInfo.email });
    } catch (error) {
      res.status(400).json({ error: { message: 'Error al validar credenciales' } });
    }
  };
  ```
- **Acceptance Criteria**:
  - [ ] Valida token contra API de MP
  - [ ] Guarda credenciales encriptadas
  - [ ] Retorna email de cuenta conectada

## Phase 4: Actualizar Flujo de Pagos
**Goal**: Modificar el flujo de pagos públicos para usar credenciales del tenant

### Task 4.1: Actualizar endpoint de crear preferencia en rutas públicas
- **Location**: `backend/src/routes/publico.routes.js`
- **Description**: Modificar endpoint `/api/publico/:slug/pedido/:id/pagar` para usar credenciales del tenant
- **Dependencies**: Task 2.2
- **Complexity**: 5
- **Implementation Details**:
  - Reemplazar uso de `process.env.MERCADOPAGO_ACCESS_TOKEN` por `getMercadoPagoClient(tenantId)`
  - Si tenant no tiene MP configurado, retornar error claro
  - Usar servicio `mercadopago.service.js` para crear preferencia
- **Acceptance Criteria**:
  - [ ] Usa credenciales del tenant, no globales
  - [ ] Error claro si MP no está configurado
  - [ ] Preferencia se crea en cuenta del tenant

### Task 4.2: Actualizar webhook de MercadoPago
- **Location**: `backend/src/controllers/pagos.controller.js`
- **Description**: Modificar webhook para identificar tenant desde external_reference y usar sus credenciales
- **Dependencies**: Task 2.2
- **Complexity**: 6
- **Implementation Details**:
  - Parsear `external_reference` que ahora incluye `{tenantId}-{pedidoId}`
  - Usar credenciales del tenant para consultar estado del pago en MP
  - Guardar transacción en tabla `TransaccionMercadoPago`
- **Acceptance Criteria**:
  - [ ] Identifica tenant desde external_reference
  - [ ] Consulta pago con credenciales del tenant
  - [ ] Guarda historial de transacción

### Task 4.3: Actualizar endpoint de config pública
- **Location**: `backend/src/routes/publico.routes.js`
- **Description**: El endpoint `/api/publico/:slug/config` debe verificar si MP está realmente configurado
- **Dependencies**: Task 2.2
- **Complexity**: 3
- **Implementation Details**:
  ```javascript
  // En GET /:slug/config
  const mpConfigured = await isMercadoPagoConfigured(tenantId);

  res.json({
    // ... otros campos
    config: {
      // ...
      mercadopago_enabled: configMap.mercadopago_enabled === 'true' && mpConfigured,
    }
  });
  ```
- **Acceptance Criteria**:
  - [ ] `mercadopago_enabled` solo es true si hay credenciales válidas
  - [ ] Frontend muestra opciones de pago correctas

## Phase 5: Frontend - Panel de Configuración
**Goal**: Actualizar UI de configuración para conectar MercadoPago

### Task 5.1: Crear componente MercadoPagoConfig
- **Location**: `frontend/src/components/configuracion/MercadoPagoConfig.jsx`
- **Description**: Componente para mostrar estado de conexión y botones de conectar/desconectar
- **Dependencies**: Task 3.2
- **Complexity**: 5
- **Implementation Details**:
  ```jsx
  // Estados: no conectado, conectando, conectado (OAuth), conectado (manual)
  // Botón "Conectar con MercadoPago" que redirige a OAuth
  // Opción "Configuración manual" expandible
  // Mostrar email de cuenta conectada
  // Botón "Desconectar"
  ```
- **Acceptance Criteria**:
  - [ ] Muestra estado actual de conexión
  - [ ] Botón de OAuth funcional
  - [ ] Formulario manual funcional
  - [ ] Opción de desconectar

### Task 5.2: Integrar componente en página de Configuración
- **Location**: `frontend/src/pages/admin/Configuracion.jsx`
- **Description**: Reemplazar checkbox simple por nuevo componente
- **Dependencies**: Task 5.1
- **Complexity**: 3
- **Implementation Details**:
  - Importar y usar `MercadoPagoConfig`
  - Eliminar checkbox `mercadopago_enabled`
  - Agregar estado para cargar info de MP
  - Detectar parámetro `?mp=connected` para mostrar mensaje de éxito
- **Acceptance Criteria**:
  - [ ] Componente integrado correctamente
  - [ ] Mensaje de éxito al conectar
  - [ ] Estado se actualiza al conectar/desconectar

## Phase 6: Frontend - Historial de Transacciones
**Goal**: Mostrar historial de pagos de MercadoPago al admin

### Task 6.1: Crear endpoint de historial de transacciones
- **Location**: `backend/src/controllers/mercadopago-oauth.controller.js`
- **Description**: Endpoint para listar transacciones del tenant con paginación
- **Dependencies**: Task 1.2
- **Complexity**: 4
- **Implementation Details**:
  ```javascript
  // GET /api/mercadopago/transacciones
  const listarTransacciones = async (req, res) => {
    const tenantId = req.tenantId;
    const { page = 1, limit = 20, desde, hasta } = req.query;

    const where = { tenantId };
    if (desde || hasta) {
      where.createdAt = {};
      if (desde) where.createdAt.gte = new Date(desde);
      if (hasta) where.createdAt.lte = new Date(hasta);
    }

    const [transacciones, total] = await Promise.all([
      prisma.transaccionMercadoPago.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: parseInt(limit),
        include: { pago: { include: { pedido: true } } }
      }),
      prisma.transaccionMercadoPago.count({ where })
    ]);

    // Calcular totales
    const totales = await prisma.transaccionMercadoPago.aggregate({
      where: { ...where, status: 'approved' },
      _sum: { amount: true, fee: true, netAmount: true }
    });

    res.json({
      transacciones,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      totales: {
        bruto: totales._sum.amount || 0,
        comisiones: totales._sum.fee || 0,
        neto: totales._sum.netAmount || 0
      }
    });
  };
  ```
- **Acceptance Criteria**:
  - [ ] Paginación funcional
  - [ ] Filtro por fechas
  - [ ] Incluye totales agregados

### Task 6.2: Crear página de Transacciones MercadoPago
- **Location**: `frontend/src/pages/admin/TransaccionesMercadoPago.jsx`
- **Description**: Página para ver historial de transacciones con filtros y totales
- **Dependencies**: Task 6.1
- **Complexity**: 5
- **Implementation Details**:
  - Tabla con: fecha, pedido #, monto, comisión, neto, estado, método
  - Filtros por rango de fechas
  - Cards con totales (bruto, comisiones, neto)
  - Paginación
  - Link a detalle del pedido
- **Acceptance Criteria**:
  - [ ] Lista transacciones correctamente
  - [ ] Filtros funcionan
  - [ ] Totales calculados
  - [ ] Navegación a pedido

### Task 6.3: Agregar link en navegación admin
- **Location**: `frontend/src/components/layouts/AdminLayout.jsx`
- **Description**: Agregar item de menú para transacciones MP
- **Dependencies**: Task 6.2
- **Complexity**: 1
- **Acceptance Criteria**:
  - [ ] Link visible en sidebar
  - [ ] Icono apropiado
  - [ ] Ruta configurada

## Phase 7: Manejo de Fallback (Sin MP)
**Goal**: Comportamiento correcto cuando tenant no tiene MP configurado

### Task 7.1: Actualizar frontend de menú público
- **Location**: `frontend/src/pages/MenuPublico.jsx`
- **Description**: Si MP no está habilitado/configurado, solo mostrar opción de efectivo
- **Dependencies**: Task 4.3
- **Complexity**: 3
- **Implementation Details**:
  - Ya implementado parcialmente (línea 809-836)
  - Agregar mensaje informativo: "Este local solo acepta pago en efectivo/presencial"
  - Si solo hay efectivo, pre-seleccionar automáticamente
- **Acceptance Criteria**:
  - [ ] Solo muestra métodos de pago disponibles
  - [ ] Mensaje claro si solo efectivo
  - [ ] No intenta crear preferencia MP si no está configurado

### Task 7.2: Agregar validación en backend
- **Location**: `backend/src/routes/publico.routes.js`
- **Description**: Validar que no se intente pagar con MP si no está configurado
- **Dependencies**: Task 4.1
- **Complexity**: 2
- **Implementation Details**:
  - Ya existe validación básica, reforzar con verificación de credenciales reales
  - Retornar error descriptivo
- **Acceptance Criteria**:
  - [ ] Error claro si se intenta pagar con MP sin configuración
  - [ ] Status code 400 apropiado

## Testing Strategy

- **Unit Tests**:
  - `backend/src/__tests__/crypto.service.test.js`: Encriptación/desencriptación
  - `backend/src/__tests__/mercadopago.service.test.js`: Mocks de cliente MP
  - Coverage target: 80%

- **Integration Tests**:
  - `backend/src/__tests__/mercadopago-oauth.test.js`: Flujo OAuth completo con mocks
  - `backend/src/__tests__/publico-pagos.test.js`: Creación de preferencia multi-tenant

- **E2E Tests**:
  - Flujo completo: Conectar MP → Hacer pedido → Pagar → Verificar transacción
  - Flujo sin MP: Hacer pedido → Solo efectivo disponible

- **Test Commands**:
  ```bash
  cd backend && npm test
  cd frontend && npm test
  ```

## Dependency Graph

### Tasks With No Dependencies (Can Start Immediately)
- Task 1.1: Crear modelo MercadoPagoConfig
- Task 2.1: Crear servicio de encriptación

### Dependency Chains
```
Task 1.1 ─┬─► Task 1.2 ───► Task 1.3 ───► Task 2.2 ─┬─► Task 3.1 ───► Task 3.2 ───► Task 3.3
          │                                          │
Task 2.1 ─┘                                          ├─► Task 4.1
                                                     ├─► Task 4.2
                                                     └─► Task 4.3 ───► Task 7.1

Task 3.2 ───► Task 5.1 ───► Task 5.2

Task 1.2 ───► Task 6.1 ───► Task 6.2 ───► Task 6.3
```

### Parallel Execution Groups
- **Group A** (no dependencies): Task 1.1, Task 2.1
- **Group B** (after Task 1.3): Task 2.2
- **Group C** (after Task 2.2): Task 3.1, Task 4.1, Task 4.2, Task 4.3
- **Group D** (after Task 3.2): Task 5.1, Task 6.1
- **Group E** (after Group D): Task 5.2, Task 6.2, Task 7.1
- **Group F** (final): Task 6.3, Task 7.2

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `backend/prisma/schema.prisma` | Modify | Agregar modelos MercadoPagoConfig y TransaccionMercadoPago |
| `backend/src/services/crypto.service.js` | Create | Servicio de encriptación AES-256 |
| `backend/src/services/mercadopago.service.js` | Create | Servicio multi-tenant de MercadoPago |
| `backend/src/controllers/mercadopago-oauth.controller.js` | Create | Controlador OAuth y configuración |
| `backend/src/routes/mercadopago.routes.js` | Create | Rutas de MercadoPago |
| `backend/src/routes/publico.routes.js` | Modify | Usar servicio MP multi-tenant |
| `backend/src/controllers/pagos.controller.js` | Modify | Webhook multi-tenant |
| `backend/src/app.js` | Modify | Registrar nuevas rutas |
| `backend/.env.example` | Modify | Agregar variables MP_APP_ID, MP_APP_SECRET, ENCRYPTION_KEY |
| `frontend/src/components/configuracion/MercadoPagoConfig.jsx` | Create | Componente de conexión MP |
| `frontend/src/pages/admin/Configuracion.jsx` | Modify | Integrar componente MP |
| `frontend/src/pages/admin/TransaccionesMercadoPago.jsx` | Create | Página de historial |
| `frontend/src/components/layouts/AdminLayout.jsx` | Modify | Link a transacciones |
| `frontend/src/pages/MenuPublico.jsx` | Modify | Mejorar fallback sin MP |

## Potential Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Token OAuth expira y no se renueva | Medium | High | Implementar refresh automático antes de expiración |
| Credenciales mal encriptadas/perdidas | Low | Critical | Backup de ENCRYPTION_KEY, tests de encrypt/decrypt |
| Webhook no identifica tenant correctamente | Medium | High | Logging detallado, formato consistente de external_reference |
| Rate limiting de MercadoPago | Low | Medium | Implementar retry con backoff exponencial |
| Usuario conecta cuenta MP equivocada | Medium | Medium | Mostrar email de cuenta antes de confirmar |

## Rollback Plan

1. **Base de datos**:
   ```bash
   npx prisma migrate rollback
   ```
2. **Código**: Revertir commits de esta feature branch
3. **Configuración**: Los tenants que conectaron MP seguirán con datos en DB pero el código anterior los ignorará (usa env global)
4. **Comunicación**: Notificar a tenants afectados si hubo rollback en producción

## Success Metrics

- [ ] Al menos 1 tenant puede conectar su cuenta MP vía OAuth
- [ ] Pago completo funciona end-to-end con credenciales del tenant
- [ ] Transacción aparece en historial del admin
- [ ] Tenant sin MP solo ve opción de efectivo
- [ ] Tests unitarios e integración pasando (>80% coverage en nuevos archivos)
- [ ] Sin errores críticos en logs durante 24h post-deploy
