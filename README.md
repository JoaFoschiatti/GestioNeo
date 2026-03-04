# Comanda

Sistema de gestión integral para restaurantes y locales gastronómicos. Incluye punto de venta (POS), gestión de inventario, control de empleados y liquidación de sueldos.

## Características

- **Punto de Venta (POS)**: Gestión de pedidos por mesa, delivery y mostrador
- **Menú Público QR**: Los clientes pueden ver el menú y hacer pedidos desde su celular
- **Gestión de Inventario**: Control de stock con alertas de bajo inventario
- **Control de Empleados**: Fichaje de entrada/salida y liquidación de sueldos
- **Reportes**: Ventas, productos más vendidos, ventas por mozo, inventario
- **Pagos**: Efectivo, tarjeta y MercadoPago integrado
- **Roles de Usuario**: Admin, Mozo, Cocinero, Cajero, Delivery

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | React 19 + Vite + Tailwind CSS v4 |
| Backend | Node.js + Express 5 |
| ORM | Prisma |
| Base de Datos | PostgreSQL |
| Pagos | MercadoPago |

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                             │
│                   React + Vite + Tailwind v4                 │
│                     http://localhost:5173                    │
├─────────────────────────────────────────────────────────────┤
│   ADMIN      │    MOZO     │  COCINERO  │   DELIVERY        │
│  /dashboard  │ /mozo/mesas │  /cocina   │ /delivery/pedidos │
│  /productos  │  /pedidos   │            │                   │
│  /reportes   │             │            │     PUBLIC        │
│  /config     │             │            │     /menu (QR)    │
└──────────────┴─────────────┴────────────┴───────────────────┘
                              │
                              │ axios (HTTP + JWT)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                          BACKEND                             │
│                Node.js + Express + Prisma                    │
│                    http://localhost:3001                     │
├─────────────────────────────────────────────────────────────┤
│  app.js ──▶ Middleware (JWT/Roles) ──▶ Routes ──▶ Controllers│
│                                                              │
│  /api/auth         /api/pedidos       /api/productos        │
│  /api/empleados    /api/ingredientes  /api/liquidaciones    │
│  /api/reportes     /api/pagos         /api/configuracion    │
│  /api/publico      /api/impresion                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │    PostgreSQL    │
                    └──────────────────┘
```

## Instalación

### Requisitos

- Node.js 18+
- PostgreSQL 14+
- npm o yarn

### Backend

```bash
cd backend
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Crear base de datos y ejecutar migraciones
npx prisma migrate dev

# Cargar datos de prueba
node prisma/seed-ewald.js       # Productos de ejemplo
node prisma/seed-test-data.js   # Usuarios y datos de prueba

# Iniciar servidor
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Variables de Entorno

```bash
# Backend (.env)
PORT=3001
NODE_ENV=development
# Nota: usar 127.0.0.1 evita problemas de IPv6 (::1) en algunas instalaciones.
DATABASE_URL="postgresql://usuario:password@127.0.0.1:5432/comanda?schema=public"
DIRECT_URL="postgresql://usuario:password@127.0.0.1:5432/comanda?schema=public"
JWT_SECRET="tu-secreto-jwt-muy-seguro"
JWT_EXPIRES_IN="24h"
MERCADOPAGO_ACCESS_TOKEN="TEST-xxxx"
FRONTEND_URL="http://localhost:5173"
```

## Usuarios de Prueba

| Email | Password | Rol | Acceso |
|-------|----------|-----|--------|
| admin@ewald.com | 123456 | ADMIN | Acceso completo |
| mozo1@ewald.com | 123456 | MOZO | Mesas y pedidos |
| cocina@ewald.com | 123456 | COCINERO | Pantalla de cocina |
| caja@ewald.com | 123456 | CAJERO | Pagos y reportes |
| delivery@ewald.com | 123456 | DELIVERY | Pedidos delivery |

## Estructura del Proyecto

```
Comanda/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma         # Modelos de base de datos
│   │   ├── seed-ewald.js         # Productos de ejemplo
│   │   └── seed-test-data.js     # Datos de prueba
│   ├── src/
│   │   ├── app.js                # Entry point Express
│   │   ├── controllers/          # Lógica de negocio
│   │   ├── routes/               # Definición de rutas
│   │   ├── middlewares/          # Auth, roles
│   │   └── services/             # Email, etc.
│   └── uploads/                  # Imágenes de productos
├── frontend/
│   ├── src/
│   │   ├── App.jsx               # Router principal
│   │   ├── context/              # AuthContext
│   │   ├── pages/                # Vistas por rol
│   │   ├── components/           # Componentes reutilizables
│   │   └── services/             # API client
│   └── public/
├── docs/
│   └── ARCHITECTURE.md           # Documentación técnica detallada
└── DEPLOY.md                     # Guía de deploy a producción
```

## API Endpoints

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/registrar` - Registrar usuario (admin)
- `GET /api/auth/perfil` - Obtener perfil actual

### Pedidos
- `GET /api/pedidos` - Listar pedidos
- `GET /api/pedidos/cocina` - Vista de cocina
- `POST /api/pedidos` - Crear pedido
- `PATCH /api/pedidos/:id/estado` - Cambiar estado

### Público (sin autenticación)
- `GET /api/publico/menu` - Menú para clientes
- `POST /api/publico/pedido` - Crear pedido desde menú QR
- `POST /api/publico/pedido/:id/pagar` - Iniciar pago MercadoPago

### Reportes
- `GET /api/reportes/dashboard` - Métricas del día
- `GET /api/reportes/ventas` - Reporte de ventas
- `GET /api/reportes/productos-mas-vendidos` - Ranking de productos
- `GET /api/reportes/ventas-por-mozo` - Ventas por empleado

## Flujo de Pedidos

```
PENDIENTE ──▶ EN_PREPARACION ──▶ LISTO ──▶ ENTREGADO ──▶ COBRADO
    │                                                        │
    └────────────────────── CANCELADO ◀──────────────────────┘
```

## Deploy a Producción

Ver [DEPLOY.md](./DEPLOY.md) para guía completa de deploy con:
- **Supabase** - Base de datos PostgreSQL (gratis)
- **Railway** - Backend Node.js (~$5/mes)
- **Vercel** - Frontend React (gratis)

## Impresion en Cloud

Si el backend corre en cloud, necesitas un print bridge local en la PC del negocio para imprimir.
Ver `bridge/README.md`.
## Documentación

Para documentación técnica detallada incluyendo diagramas de base de datos, flujos de datos y permisos por rol, ver [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Licencia

ISC
