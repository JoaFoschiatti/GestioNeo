-- CreateEnum
CREATE TYPE "EstadoCaja" AS ENUM ('ABIERTO', 'CERRADO');

-- CreateTable
CREATE TABLE "cierres_caja" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "horaApertura" TIMESTAMP(3) NOT NULL,
    "horaCierre" TIMESTAMP(3),
    "fondoInicial" DECIMAL(10,2) NOT NULL,
    "totalEfectivo" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalTarjeta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalMP" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "efectivoFisico" DECIMAL(10,2),
    "diferencia" DECIMAL(10,2),
    "estado" "EstadoCaja" NOT NULL DEFAULT 'ABIERTO',
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cierres_caja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cierres_caja_fecha_idx" ON "cierres_caja"("fecha");

-- CreateIndex
CREATE INDEX "cierres_caja_usuarioId_fecha_idx" ON "cierres_caja"("usuarioId", "fecha");

-- AddForeignKey
ALTER TABLE "cierres_caja" ADD CONSTRAINT "cierres_caja_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
