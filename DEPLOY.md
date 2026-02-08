# Deploy Producción (AWS EC2 + RDS + Docker + Nginx)

Este documento refleja el deploy actual de **GestioNeo** en arquitectura de **instancia única**.

## Arquitectura objetivo

- **EC2**: corre containers Docker (`backend`, `frontend`, `nginx`).
- **RDS PostgreSQL**: base de datos administrada.
- **Nginx**: mismo dominio para todo:
  - `/` -> frontend
  - `/api` -> backend
- **Instancia única**: sistema personalizado para un único cliente.

---

## 1. Pre-requisitos AWS

1. Crear una instancia **EC2 Ubuntu 22.04+** (recomendado `t3.small` o superior).
2. Crear una base **RDS PostgreSQL** (misma VPC).
3. Security Groups:
   - EC2 inbound: `80` (y `22` para administración).
   - RDS inbound: `5432` solo desde SG de EC2.
4. DNS del dominio apuntando al endpoint público (ALB o EC2).

---

## 2. Preparar EC2

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg git

# Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Reconectar sesión SSH para aplicar el grupo `docker`.

---

## 3. Clonar proyecto y configurar variables

```bash
sudo mkdir -p /opt/gestioneo
sudo chown -R $USER:$USER /opt/gestioneo
cd /opt/gestioneo
git clone https://github.com/JoaFoschiatti/GestioNeo.git .
```

### 3.1 Backend env (`backend/.env.production`)

```env
NODE_ENV=production
PORT=3001

DATABASE_URL=postgresql://USER:PASSWORD@RDS_HOST:5432/DB_NAME
DIRECT_URL=postgresql://USER:PASSWORD@RDS_HOST:5432/DB_NAME

FRONTEND_URL=https://tu-dominio.com
BACKEND_URL=https://tu-dominio.com

JWT_SECRET=CAMBIAR_POR_SECRETO_LARGO
PUBLIC_ORDER_TOKEN_SECRET=CAMBIAR_POR_SECRETO_LARGO
ENCRYPTION_KEY=CAMBIAR_POR_64_HEX
BRIDGE_TOKEN=CAMBIAR_POR_TOKEN_SEGURO

# MercadoPago (si aplica)
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_PUBLIC_KEY=
MERCADOPAGO_WEBHOOK_SECRET=
MP_SAAS_ACCESS_TOKEN=
MP_SUBSCRIPTION_WEBHOOK_SECRET=

# Email (si aplica)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=
```

### 3.2 Frontend env (`frontend/.env.production`)

```env
VITE_API_URL=/api
VITE_FRONTEND_URL=https://tu-dominio.com
```

---

## 4. Deploy con Docker Compose

Este repo incluye:
- `deploy/docker-compose.ec2.yml`
- `deploy/nginx/default.conf`

Comandos:

```bash
cd /opt/gestioneo
docker compose -f deploy/docker-compose.ec2.yml up -d --build
docker compose -f deploy/docker-compose.ec2.yml ps
```

El backend ejecuta `prisma migrate deploy` al iniciar.

---

## 5. Verificación

1. Salud API:
```bash
curl -i http://localhost/api/health
```
2. Desde navegador:
   - `https://tu-dominio.com/login`
   - `https://tu-dominio.com/menu`
3. Validar login y creación de pedido público.

---

## 6. Actualización de versión

```bash
cd /opt/gestioneo
git pull origin main
docker compose -f deploy/docker-compose.ec2.yml up -d --build
```

---

## 7. Logs y rollback

### Logs
```bash
docker compose -f deploy/docker-compose.ec2.yml logs -f backend
docker compose -f deploy/docker-compose.ec2.yml logs -f nginx
```

### Rollback rápido
```bash
git checkout <commit_estable>
docker compose -f deploy/docker-compose.ec2.yml up -d --build
```

---

## 8. Notas operativas

- No existe routing por cliente ni slug de cliente.
- No usar endpoints heredados del modelo SaaS anterior.
- Toda la configuración del negocio se administra por `/api/configuracion/negocio`.

---

## 9. Backup y recuperación (RDS)

1. Activar snapshots automáticos en RDS (mínimo 7 días, recomendado 14+).
2. Antes de cada release importante, crear snapshot manual:
```bash
aws rds create-db-snapshot \
  --db-instance-identifier <db-instance-id> \
  --db-snapshot-identifier gestioneo-predeploy-$(date +%Y%m%d-%H%M%S)
```
3. Probar recuperación al menos una vez por trimestre en entorno de staging.

---

## 10. Healthchecks y observabilidad mínima

- API: `GET /api/health` desde Nginx y desde host.
- Logs:
  - `docker compose -f deploy/docker-compose.ec2.yml logs -f backend`
  - `docker compose -f deploy/docker-compose.ec2.yml logs -f nginx`
- Métricas recomendadas (CloudWatch):
  - CPU/Memoria de EC2
  - Conexiones de RDS
  - Errores 5xx en Nginx/API

---

## 11. Checklist post-deploy

1. `curl -i http://localhost/api/health` devuelve `200`.
2. Login correcto en `https://tu-dominio.com/login`.
3. Crear pedido interno (mostrador o mesa) y validar flujo completo.
4. Validar menú público `https://tu-dominio.com/menu`.
5. Verificar que no hay errores recurrentes en logs en los primeros 10 minutos.

---

## 12. Rollback operativo recomendado

Si el release falla:

1. Volver a commit estable:
```bash
cd /opt/gestioneo
git checkout <commit_estable>
docker compose -f deploy/docker-compose.ec2.yml up -d --build
```
2. Si el problema es de datos, restaurar snapshot RDS.
3. Repetir checklist post-deploy antes de reabrir tráfico.
