-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('CONFIRMADA', 'CLIENTE_PRESENTE', 'NO_LLEGO', 'CANCELADA');

-- CreateTable
CREATE TABLE "reservas" (
    "id" SERIAL NOT NULL,
    "mesaId" INTEGER NOT NULL,
    "clienteNombre" TEXT NOT NULL,
    "clienteTelefono" TEXT,
    "fechaHora" TIMESTAMP(3) NOT NULL,
    "cantidadPersonas" INTEGER NOT NULL,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'CONFIRMADA',
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservas_fechaHora_idx" ON "reservas"("fechaHora");

-- CreateIndex
CREATE INDEX "reservas_mesaId_fechaHora_idx" ON "reservas"("mesaId", "fechaHora");

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "mesas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
