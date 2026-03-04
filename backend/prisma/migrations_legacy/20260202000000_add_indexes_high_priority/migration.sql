-- High-priority performance indexes (FKs + MercadoPago lookups)
-- Generated via: prisma migrate diff --from-url ... --to-schema-datamodel prisma/schema.prisma --script

-- CreateIndex
CREATE INDEX "fichajes_empleadoId_idx" ON "fichajes"("empleadoId");

-- CreateIndex
CREATE INDEX "liquidaciones_empleadoId_idx" ON "liquidaciones"("empleadoId");

-- CreateIndex
CREATE INDEX "movimientos_stock_pedidoId_idx" ON "movimientos_stock"("pedidoId");

-- CreateIndex
CREATE INDEX "pagos_pedidoId_idx" ON "pagos"("pedidoId");

-- CreateIndex
CREATE INDEX "pagos_mpPaymentId_idx" ON "pagos"("mpPaymentId");

-- CreateIndex
CREATE INDEX "pedido_item_modificadores_pedidoItemId_idx" ON "pedido_item_modificadores"("pedidoItemId");

-- CreateIndex
CREATE INDEX "pedido_item_modificadores_modificadorId_idx" ON "pedido_item_modificadores"("modificadorId");

-- CreateIndex
CREATE INDEX "pedido_items_pedidoId_idx" ON "pedido_items"("pedidoId");

-- CreateIndex
CREATE INDEX "pedido_items_productoId_idx" ON "pedido_items"("productoId");

-- CreateIndex
CREATE INDEX "pedidos_mesaId_idx" ON "pedidos"("mesaId");

-- CreateIndex
CREATE INDEX "pedidos_usuarioId_idx" ON "pedidos"("usuarioId");

-- CreateIndex
CREATE INDEX "print_jobs_pedidoId_idx" ON "print_jobs"("pedidoId");

-- CreateIndex
CREATE INDEX "producto_ingredientes_productoId_idx" ON "producto_ingredientes"("productoId");

-- CreateIndex
CREATE INDEX "producto_ingredientes_ingredienteId_idx" ON "producto_ingredientes"("ingredienteId");

-- CreateIndex
CREATE INDEX "producto_modificadores_productoId_idx" ON "producto_modificadores"("productoId");

-- CreateIndex
CREATE INDEX "producto_modificadores_modificadorId_idx" ON "producto_modificadores"("modificadorId");

-- CreateIndex
CREATE INDEX "productos_categoriaId_idx" ON "productos"("categoriaId");

-- CreateIndex
CREATE INDEX "reservas_mesaId_idx" ON "reservas"("mesaId");

-- CreateIndex
CREATE INDEX "transacciones_mercadopago_pagoId_idx" ON "transacciones_mercadopago"("pagoId");

