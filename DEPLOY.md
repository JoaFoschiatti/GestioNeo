# Guía de Deploy a Producción - Comanda

Esta guía te llevará paso a paso para desplegar Comanda en producción usando:
- **Supabase** - Base de datos PostgreSQL (gratis)
- **Railway** - Backend Node.js (~$5/mes)
- **Vercel** - Frontend React (gratis)

**Tiempo estimado:** 30-60 minutos

---

## Índice

1. [Pre-requisitos](#1-pre-requisitos)
2. [Paso 1: Configurar Supabase](#2-paso-1-configurar-supabase)
3. [Paso 2: Configurar Railway](#3-paso-2-configurar-railway)
4. [Paso 3: Configurar Vercel](#4-paso-3-configurar-vercel)
5. [Paso 4: Verificación](#5-paso-4-verificación)
6. [Troubleshooting](#6-troubleshooting)
7. [Mantenimiento](#7-mantenimiento)

---

## 1. Pre-requisitos

### Cuentas necesarias (todas gratuitas para crear)
- [ ] Cuenta en [GitHub](https://github.com) con el repositorio de Comanda
- [ ] Cuenta en [Supabase](https://supabase.com)
- [ ] Cuenta en [Railway](https://railway.app)
- [ ] Cuenta en [Vercel](https://vercel.com)

### En tu máquina local
- [ ] Git instalado
- [ ] Node.js 18+ instalado
- [ ] El proyecto funcionando localmente

### Subir código a GitHub (si no lo hiciste)
```bash
cd /home/zet/Comanda
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/comanda.git
git push -u origin main
```

---

## 2. Paso 1: Configurar Supabase

### 2.1 Crear proyecto

1. Ir a [supabase.com](https://supabase.com) → **Start your project**
2. Click en **New Project**
3. Completar:
   - **Name:** `comanda-prod`
   - **Database Password:** (guardar en lugar seguro, lo necesitarás)
   - **Region:** Elegir el más cercano (ej: `South America (São Paulo)`)
4. Click **Create new project** (tarda ~2 minutos)

### 2.2 Obtener Connection String

1. En el dashboard de Supabase, ir a **Settings** → **Database**
2. En la sección **Connection string**, seleccionar **URI**
3. Copiar el string, se ve así:
   ```
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
   ```
4. **IMPORTANTE:** Reemplazar `[YOUR-PASSWORD]` con la contraseña que pusiste

### 2.3 Guardar para después

```env
# Guardar estos valores:
DATABASE_URL=postgresql://postgres.xxxxx:TU_PASSWORD@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.xxxxx:TU_PASSWORD@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

> **Nota:** El `DATABASE_URL` usa puerto `6543` (pooler), el `DIRECT_URL` usa `5432` (directo, para migraciones)

---

## 3. Paso 2: Configurar Railway

### 3.1 Crear proyecto

1. Ir a [railway.app](https://railway.app) → **Login with GitHub**
2. Click en **New Project** → **Deploy from GitHub repo**
3. Seleccionar el repositorio `comanda`
4. Railway detectará que es un monorepo, seleccionar **backend** como carpeta root

### 3.2 Configurar el servicio

1. Click en el servicio creado
2. Ir a **Settings**:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npx prisma generate && npx prisma migrate deploy`
   - **Start Command:** `npm start`

### 3.3 Configurar variables de entorno

1. Ir a la pestaña **Variables**
2. Agregar las siguientes variables:

```env
DATABASE_URL=postgresql://postgres.xxxxx:PASSWORD@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.xxxxx:PASSWORD@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
JWT_SECRET=una-clave-secreta-muy-larga-y-segura-de-al-menos-32-caracteres
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://tu-app.vercel.app
```

> **Tip:** Para generar un JWT_SECRET seguro:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### 3.4 Obtener URL del backend

1. Ir a **Settings** → **Networking**
2. Click en **Generate Domain**
3. Copiar la URL generada, será algo como:
   ```
   https://comanda-backend-production.up.railway.app
   ```

### 3.5 Ejecutar migraciones (primera vez)

Una vez que el deploy esté completo:

1. En Railway, ir a tu servicio
2. Click en **Settings** → **Deploy** → **Redeploy**

O desde tu terminal local:
```bash
cd backend
DATABASE_URL="tu-connection-string-de-supabase" DIRECT_URL="tu-connection-string-directo-de-supabase" npx prisma migrate deploy
DATABASE_URL="tu-connection-string-de-supabase" node prisma/seed-ewald.js
DATABASE_URL="tu-connection-string-de-supabase" node prisma/seed-test-data.js
```

---

## 4. Paso 3: Configurar Vercel

### 4.1 Importar proyecto

1. Ir a [vercel.com](https://vercel.com) → **Add New Project**
2. Seleccionar el repositorio `comanda`
3. Configurar:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

### 4.2 Configurar variables de entorno

En la sección **Environment Variables**, agregar:

```env
VITE_API_URL=https://comanda-backend-production.up.railway.app/api
```

> Reemplazar con la URL real de tu backend en Railway

### 4.3 Deploy

1. Click en **Deploy**
2. Esperar ~2 minutos
3. Vercel te dará una URL como: `https://comanda.vercel.app`

### 4.4 Actualizar CORS en Railway

Volver a Railway y actualizar la variable:
```env
FRONTEND_URL=https://comanda.vercel.app
```

Esto permite que el frontend pueda comunicarse con el backend.

---

## 5. Paso 4: Verificación

### Checklist post-deploy

- [ ] Acceder a `https://tu-app.vercel.app`
- [ ] Login con `admin@ewald.com` / `123456`
- [ ] Verificar que carga el dashboard
- [ ] Verificar que cargan los productos
- [ ] Crear un pedido de prueba
- [ ] Verificar los reportes
- [ ] Probar el menú público en `/menu`

### URLs finales

| Servicio | URL |
|----------|-----|
| Frontend | `https://tu-app.vercel.app` |
| Backend | `https://tu-backend.railway.app` |
| Menú Público | `https://tu-app.vercel.app/menu` |

---

## 6. Troubleshooting

### Error: "Cannot connect to database"
- Verificar que `DATABASE_URL` esté correcta en Railway
- Verificar que la contraseña no tenga caracteres especiales sin escapar
- Usar `?pgbouncer=true` al final del connection string

### Error: "CORS blocked"
- Verificar que `FRONTEND_URL` en Railway coincida exactamente con la URL de Vercel
- No incluir `/` al final de la URL

### Error: "Prisma schema out of sync"
```bash
# Ejecutar desde tu máquina local
cd backend
DATABASE_URL="tu-url" DIRECT_URL="tu-url-directa" npx prisma migrate deploy
npx prisma generate
```

### El frontend no carga datos
- Verificar en DevTools → Network que las llamadas a la API no den 404
- Verificar que `VITE_API_URL` termine en `/api`

### Railway: Build fails
- Verificar que `package.json` tenga script `start`
- El script start debe ser: `"start": "node src/server.js"`

---

## 7. Mantenimiento

### Actualizar código

Los deploys son automáticos cuando haces push a `main`:
```bash
git add .
git commit -m "Nueva funcionalidad"
git push origin main
```

Railway y Vercel detectan el push y re-deployean automáticamente.

### Ejecutar migraciones nuevas

Si modificas el schema de Prisma:
```bash
# Desde tu máquina local (crea y commitea la migración)
cd backend
npx prisma migrate dev

# En producción: Railway aplica automáticamente con `npx prisma migrate deploy` en el build.
# Si necesitás aplicarlas manualmente:
DATABASE_URL="tu-url" DIRECT_URL="tu-url-directa-produccion" npx prisma migrate deploy
```

### Ver logs en producción

**Railway:**
- Dashboard → Tu servicio → **Deployments** → Click en deploy → **View Logs**

**Vercel:**
- Dashboard → Tu proyecto → **Functions** → Ver logs

### Backup de base de datos

Supabase hace backups automáticos diarios. Para backup manual:
1. Supabase Dashboard → **Database** → **Backups**
2. Click en **Create backup**

---

## Costos Estimados Mensuales

| Servicio | Plan | Costo |
|----------|------|-------|
| Supabase | Free | $0 |
| Railway | Hobby | ~$5 |
| Vercel | Hobby | $0 |
| **Total** | | **~$5/mes** |

> Para un restaurante con 100 pedidos/día, estos recursos son más que suficientes.

---

## Soporte

Si tenés problemas con el deploy:
1. Revisar la sección de Troubleshooting
2. Verificar los logs en Railway/Vercel
3. Revisar la documentación oficial:
   - [Supabase Docs](https://supabase.com/docs)
   - [Railway Docs](https://docs.railway.app)
   - [Vercel Docs](https://vercel.com/docs)
