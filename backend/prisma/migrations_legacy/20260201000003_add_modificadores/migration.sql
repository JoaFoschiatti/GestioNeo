-- CreateEnum
CREATE TYPE "TipoModificador" AS ENUM ('EXCLUSION', 'ADICION');

-- CreateTable
CREATE TABLE "modificadores" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tipo" "TipoModificador" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modificadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto_modificadores" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "modificadorId" INTEGER NOT NULL,

    CONSTRAINT "producto_modificadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_item_modificadores" (
    "id" SERIAL NOT NULL,
    "pedidoItemId" INTEGER NOT NULL,
    "modificadorId" INTEGER NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "pedido_item_modificadores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "modificadores_nombre_key" ON "modificadores"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "producto_modificadores_productoId_modificadorId_key" ON "producto_modificadores"("productoId", "modificadorId");

-- AddForeignKey
ALTER TABLE "producto_modificadores" ADD CONSTRAINT "producto_modificadores_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_modificadores" ADD CONSTRAINT "producto_modificadores_modificadorId_fkey" FOREIGN KEY ("modificadorId") REFERENCES "modificadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_item_modificadores" ADD CONSTRAINT "pedido_item_modificadores_pedidoItemId_fkey" FOREIGN KEY ("pedidoItemId") REFERENCES "pedido_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_item_modificadores" ADD CONSTRAINT "pedido_item_modificadores_modificadorId_fkey" FOREIGN KEY ("modificadorId") REFERENCES "modificadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
