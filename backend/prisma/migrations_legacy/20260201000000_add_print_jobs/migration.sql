-- CreateEnum
CREATE TYPE "TipoComanda" AS ENUM ('COCINA', 'CAJA', 'CLIENTE');

-- CreateEnum
CREATE TYPE "EstadoPrintJob" AS ENUM ('PENDIENTE', 'IMPRIMIENDO', 'OK', 'ERROR');

-- CreateTable
CREATE TABLE "print_jobs" (
    "id" SERIAL NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "tipo" "TipoComanda" NOT NULL,
    "status" "EstadoPrintJob" NOT NULL DEFAULT 'PENDIENTE',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "maxIntentos" INTEGER NOT NULL DEFAULT 3,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "contenido" TEXT NOT NULL,
    "anchoMm" INTEGER NOT NULL DEFAULT 80,
    "batchId" TEXT NOT NULL,
    "claimedBy" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "print_jobs_status_nextAttemptAt_idx" ON "print_jobs"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "print_jobs_pedidoId_batchId_idx" ON "print_jobs"("pedidoId", "batchId");

-- CreateIndex
CREATE UNIQUE INDEX "print_jobs_pedidoId_tipo_batchId_key" ON "print_jobs"("pedidoId", "tipo", "batchId");

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
