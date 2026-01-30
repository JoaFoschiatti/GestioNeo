-- =====================================================
-- Multi-Tenancy Migration for Comanda
-- =====================================================

-- 1. Create new enums
CREATE TYPE "PlanTenant" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- 2. Add SUPER_ADMIN to Rol enum
ALTER TYPE "Rol" ADD VALUE 'SUPER_ADMIN' BEFORE 'ADMIN';

-- 3. Create tenants table
CREATE TABLE "tenants" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "direccion" TEXT,
    "logo" TEXT,
    "bannerUrl" TEXT,
    "colorPrimario" TEXT DEFAULT '#3B82F6',
    "colorSecundario" TEXT DEFAULT '#1E40AF',
    "plan" "PlanTenant" NOT NULL DEFAULT 'FREE',
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- 4. Create email verification table
CREATE TABLE "email_verificaciones" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verificaciones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_verificaciones_token_key" ON "email_verificaciones"("token");
CREATE INDEX "email_verificaciones_tenantId_usuarioId_idx" ON "email_verificaciones"("tenantId", "usuarioId");
CREATE INDEX "email_verificaciones_token_idx" ON "email_verificaciones"("token");

-- 5. Create default tenant for existing data migration
INSERT INTO "tenants" ("slug", "nombre", "email", "activo", "updatedAt")
VALUES ('default', 'Restaurante Default', 'admin@comanda.local', true, CURRENT_TIMESTAMP);

-- 6. Add tenantId columns to all tables (nullable first for migration)
ALTER TABLE "usuarios" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "empleados" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "fichajes" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "liquidaciones" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "mesas" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "reservas" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "categorias" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "productos" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "modificadores" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "producto_modificadores" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "ingredientes" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "producto_ingredientes" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "movimientos_stock" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "pedidos" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "pedido_items" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "pedido_item_modificadores" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "pagos" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "cierres_caja" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "print_jobs" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "configuraciones" ADD COLUMN "tenantId" INTEGER;

-- 7. Backfill existing data with default tenant (id = 1)
UPDATE "usuarios" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "empleados" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "fichajes" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "liquidaciones" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "mesas" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "reservas" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "categorias" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "productos" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "modificadores" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "producto_modificadores" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "ingredientes" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "producto_ingredientes" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "movimientos_stock" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "pedidos" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "pedido_items" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "pedido_item_modificadores" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "pagos" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "cierres_caja" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "print_jobs" SET "tenantId" = 1 WHERE "tenantId" IS NULL;
UPDATE "configuraciones" SET "tenantId" = 1 WHERE "tenantId" IS NULL;

-- 8. Make tenantId NOT NULL (except usuarios which allows null for SUPER_ADMIN)
ALTER TABLE "empleados" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "fichajes" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "liquidaciones" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "mesas" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "reservas" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "categorias" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "productos" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "modificadores" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "producto_modificadores" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "ingredientes" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "producto_ingredientes" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "movimientos_stock" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "pedidos" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "pedido_items" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "pedido_item_modificadores" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "pagos" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "cierres_caja" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "print_jobs" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "configuraciones" ALTER COLUMN "tenantId" SET NOT NULL;

-- 9. Drop old unique constraints that conflict with new tenant-scoped ones
ALTER TABLE "usuarios" DROP CONSTRAINT IF EXISTS "usuarios_email_key";
ALTER TABLE "empleados" DROP CONSTRAINT IF EXISTS "empleados_dni_key";
ALTER TABLE "mesas" DROP CONSTRAINT IF EXISTS "mesas_numero_key";
ALTER TABLE "categorias" DROP CONSTRAINT IF EXISTS "categorias_nombre_key";
ALTER TABLE "ingredientes" DROP CONSTRAINT IF EXISTS "ingredientes_nombre_key";
ALTER TABLE "modificadores" DROP CONSTRAINT IF EXISTS "modificadores_nombre_key";
ALTER TABLE "producto_ingredientes" DROP CONSTRAINT IF EXISTS "producto_ingredientes_productoId_ingredienteId_key";
ALTER TABLE "producto_modificadores" DROP CONSTRAINT IF EXISTS "producto_modificadores_productoId_modificadorId_key";
ALTER TABLE "print_jobs" DROP CONSTRAINT IF EXISTS "print_jobs_pedidoId_tipo_batchId_key";
ALTER TABLE "configuraciones" DROP CONSTRAINT IF EXISTS "configuraciones_clave_key";

-- 10. Add new tenant-scoped unique constraints
CREATE UNIQUE INDEX "usuarios_tenantId_email_key" ON "usuarios"("tenantId", "email");
CREATE UNIQUE INDEX "empleados_tenantId_dni_key" ON "empleados"("tenantId", "dni");
CREATE UNIQUE INDEX "mesas_tenantId_numero_key" ON "mesas"("tenantId", "numero");
CREATE UNIQUE INDEX "categorias_tenantId_nombre_key" ON "categorias"("tenantId", "nombre");
CREATE UNIQUE INDEX "ingredientes_tenantId_nombre_key" ON "ingredientes"("tenantId", "nombre");
CREATE UNIQUE INDEX "modificadores_tenantId_nombre_key" ON "modificadores"("tenantId", "nombre");
CREATE UNIQUE INDEX "producto_ingredientes_tenantId_productoId_ingredienteId_key" ON "producto_ingredientes"("tenantId", "productoId", "ingredienteId");
CREATE UNIQUE INDEX "producto_modificadores_tenantId_productoId_modificadorId_key" ON "producto_modificadores"("tenantId", "productoId", "modificadorId");
CREATE UNIQUE INDEX "print_jobs_tenantId_pedidoId_tipo_batchId_key" ON "print_jobs"("tenantId", "pedidoId", "tipo", "batchId");
CREATE UNIQUE INDEX "configuraciones_tenantId_clave_key" ON "configuraciones"("tenantId", "clave");

-- 11. Add tenant indexes for query performance
CREATE INDEX "usuarios_tenantId_idx" ON "usuarios"("tenantId");
CREATE INDEX "empleados_tenantId_idx" ON "empleados"("tenantId");
CREATE INDEX "fichajes_tenantId_idx" ON "fichajes"("tenantId");
CREATE INDEX "fichajes_tenantId_empleadoId_fecha_idx" ON "fichajes"("tenantId", "empleadoId", "fecha");
CREATE INDEX "liquidaciones_tenantId_idx" ON "liquidaciones"("tenantId");
CREATE INDEX "mesas_tenantId_idx" ON "mesas"("tenantId");
CREATE INDEX "reservas_tenantId_idx" ON "reservas"("tenantId");
CREATE INDEX "reservas_tenantId_fechaHora_idx" ON "reservas"("tenantId", "fechaHora");
CREATE INDEX "reservas_tenantId_mesaId_fechaHora_idx" ON "reservas"("tenantId", "mesaId", "fechaHora");
CREATE INDEX "categorias_tenantId_idx" ON "categorias"("tenantId");
CREATE INDEX "productos_tenantId_idx" ON "productos"("tenantId");
CREATE INDEX "productos_tenantId_categoriaId_idx" ON "productos"("tenantId", "categoriaId");
CREATE INDEX "modificadores_tenantId_idx" ON "modificadores"("tenantId");
CREATE INDEX "producto_modificadores_tenantId_idx" ON "producto_modificadores"("tenantId");
CREATE INDEX "ingredientes_tenantId_idx" ON "ingredientes"("tenantId");
CREATE INDEX "producto_ingredientes_tenantId_idx" ON "producto_ingredientes"("tenantId");
CREATE INDEX "movimientos_stock_tenantId_idx" ON "movimientos_stock"("tenantId");
CREATE INDEX "movimientos_stock_tenantId_ingredienteId_idx" ON "movimientos_stock"("tenantId", "ingredienteId");
CREATE INDEX "pedidos_tenantId_idx" ON "pedidos"("tenantId");
CREATE INDEX "pedidos_tenantId_estado_idx" ON "pedidos"("tenantId", "estado");
CREATE INDEX "pedidos_tenantId_tipo_idx" ON "pedidos"("tenantId", "tipo");
CREATE INDEX "pedidos_tenantId_createdAt_idx" ON "pedidos"("tenantId", "createdAt");
CREATE INDEX "pedido_items_tenantId_idx" ON "pedido_items"("tenantId");
CREATE INDEX "pedido_items_tenantId_pedidoId_idx" ON "pedido_items"("tenantId", "pedidoId");
CREATE INDEX "pedido_item_modificadores_tenantId_idx" ON "pedido_item_modificadores"("tenantId");
CREATE INDEX "pagos_tenantId_idx" ON "pagos"("tenantId");
CREATE INDEX "pagos_tenantId_pedidoId_idx" ON "pagos"("tenantId", "pedidoId");
CREATE INDEX "cierres_caja_tenantId_idx" ON "cierres_caja"("tenantId");
CREATE INDEX "cierres_caja_tenantId_fecha_idx" ON "cierres_caja"("tenantId", "fecha");
CREATE INDEX "cierres_caja_tenantId_usuarioId_fecha_idx" ON "cierres_caja"("tenantId", "usuarioId", "fecha");
CREATE INDEX "print_jobs_tenantId_idx" ON "print_jobs"("tenantId");
CREATE INDEX "print_jobs_tenantId_status_nextAttemptAt_idx" ON "print_jobs"("tenantId", "status", "nextAttemptAt");
CREATE INDEX "print_jobs_tenantId_pedidoId_batchId_idx" ON "print_jobs"("tenantId", "pedidoId", "batchId");
CREATE INDEX "configuraciones_tenantId_idx" ON "configuraciones"("tenantId");

-- 12. Add foreign key constraints to tenants table
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fichajes" ADD CONSTRAINT "fichajes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "liquidaciones" ADD CONSTRAINT "liquidaciones_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mesas" ADD CONSTRAINT "mesas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "productos" ADD CONSTRAINT "productos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "modificadores" ADD CONSTRAINT "modificadores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "producto_modificadores" ADD CONSTRAINT "producto_modificadores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ingredientes" ADD CONSTRAINT "ingredientes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "producto_ingredientes" ADD CONSTRAINT "producto_ingredientes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedido_item_modificadores" ADD CONSTRAINT "pedido_item_modificadores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cierres_caja" ADD CONSTRAINT "cierres_caja_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "configuraciones" ADD CONSTRAINT "configuraciones_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_verificaciones" ADD CONSTRAINT "email_verificaciones_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_verificaciones" ADD CONSTRAINT "email_verificaciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
