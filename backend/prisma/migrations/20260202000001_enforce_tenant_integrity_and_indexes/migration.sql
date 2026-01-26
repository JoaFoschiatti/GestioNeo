-- Enforce tenant integrity and add missing indexes/constraints

-- ============================================
-- Composite uniqueness to support tenant-scoped FKs
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS "usuarios_tenantId_id_key" ON "usuarios" ("tenantId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "empleados_tenantId_id_key" ON "empleados" ("tenantId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "mesas_tenantId_id_key" ON "mesas" ("tenantId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "categorias_tenantId_id_key" ON "categorias" ("tenantId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "productos_tenantId_id_key" ON "productos" ("tenantId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "modificadores_tenantId_id_key" ON "modificadores" ("tenantId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "ingredientes_tenantId_id_key" ON "ingredientes" ("tenantId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "pedidos_tenantId_id_key" ON "pedidos" ("tenantId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "pedido_items_tenantId_id_key" ON "pedido_items" ("tenantId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "pagos_tenantId_id_key" ON "pagos" ("tenantId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "suscripciones_tenantId_id_key" ON "suscripciones" ("tenantId", "id");

-- ============================================
-- Additional indexes for hot paths
-- ============================================
CREATE INDEX IF NOT EXISTS "email_verificaciones_usedAt_expiresAt_idx" ON "email_verificaciones" ("usedAt", "expiresAt");
CREATE INDEX IF NOT EXISTS "refresh_tokens_revokedAt_idx" ON "refresh_tokens" ("revokedAt");
CREATE INDEX IF NOT EXISTS "pedidos_estadoPago_createdAt_idx" ON "pedidos" ("estadoPago", "createdAt");
CREATE INDEX IF NOT EXISTS "pagos_tenantId_estado_createdAt_idx" ON "pagos" ("tenantId", "estado", "createdAt");
CREATE INDEX IF NOT EXISTS "pagos_tenantId_pedidoId_createdAt_idx" ON "pagos" ("tenantId", "pedidoId", "createdAt");
CREATE INDEX IF NOT EXISTS "cierres_caja_tenantId_estado_createdAt_idx" ON "cierres_caja" ("tenantId", "estado", "createdAt");
CREATE INDEX IF NOT EXISTS "print_jobs_tenantId_status_claimedAt_idx" ON "print_jobs" ("tenantId", "status", "claimedAt");
CREATE INDEX IF NOT EXISTS "pagos_suscripcion_suscripcionId_createdAt_idx" ON "pagos_suscripcion" ("suscripcionId", "createdAt");

-- SUPER_ADMIN: unique email for usuarios where tenantId IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS "usuarios_email_super_admin_unique"
ON "usuarios" ("email")
WHERE "tenantId" IS NULL;

-- ============================================
-- Tenant-safe composite foreign keys
-- ============================================
ALTER TABLE "email_verificaciones"
ADD CONSTRAINT "fk_email_verif_tenant_usuario"
FOREIGN KEY ("tenantId", "usuarioId") REFERENCES "usuarios" ("tenantId", "id");

ALTER TABLE "fichajes"
ADD CONSTRAINT "fk_fichajes_tenant_empleado"
FOREIGN KEY ("tenantId", "empleadoId") REFERENCES "empleados" ("tenantId", "id");

ALTER TABLE "liquidaciones"
ADD CONSTRAINT "fk_liquidaciones_tenant_empleado"
FOREIGN KEY ("tenantId", "empleadoId") REFERENCES "empleados" ("tenantId", "id");

ALTER TABLE "reservas"
ADD CONSTRAINT "fk_reservas_tenant_mesa"
FOREIGN KEY ("tenantId", "mesaId") REFERENCES "mesas" ("tenantId", "id");

ALTER TABLE "productos"
ADD CONSTRAINT "fk_productos_tenant_categoria"
FOREIGN KEY ("tenantId", "categoriaId") REFERENCES "categorias" ("tenantId", "id");

ALTER TABLE "productos"
ADD CONSTRAINT "fk_productos_tenant_base"
FOREIGN KEY ("tenantId", "productoBaseId") REFERENCES "productos" ("tenantId", "id");

ALTER TABLE "producto_modificadores"
ADD CONSTRAINT "fk_producto_mod_tenant_producto"
FOREIGN KEY ("tenantId", "productoId") REFERENCES "productos" ("tenantId", "id");

ALTER TABLE "producto_modificadores"
ADD CONSTRAINT "fk_producto_mod_tenant_modificador"
FOREIGN KEY ("tenantId", "modificadorId") REFERENCES "modificadores" ("tenantId", "id");

ALTER TABLE "producto_ingredientes"
ADD CONSTRAINT "fk_producto_ing_tenant_producto"
FOREIGN KEY ("tenantId", "productoId") REFERENCES "productos" ("tenantId", "id");

ALTER TABLE "producto_ingredientes"
ADD CONSTRAINT "fk_producto_ing_tenant_ingrediente"
FOREIGN KEY ("tenantId", "ingredienteId") REFERENCES "ingredientes" ("tenantId", "id");

ALTER TABLE "movimientos_stock"
ADD CONSTRAINT "fk_mov_stock_tenant_ingrediente"
FOREIGN KEY ("tenantId", "ingredienteId") REFERENCES "ingredientes" ("tenantId", "id");

ALTER TABLE "movimientos_stock"
ADD CONSTRAINT "fk_mov_stock_tenant_pedido"
FOREIGN KEY ("tenantId", "pedidoId") REFERENCES "pedidos" ("tenantId", "id");

ALTER TABLE "pedidos"
ADD CONSTRAINT "fk_pedidos_tenant_mesa"
FOREIGN KEY ("tenantId", "mesaId") REFERENCES "mesas" ("tenantId", "id");

ALTER TABLE "pedidos"
ADD CONSTRAINT "fk_pedidos_tenant_usuario"
FOREIGN KEY ("tenantId", "usuarioId") REFERENCES "usuarios" ("tenantId", "id");

ALTER TABLE "pedido_items"
ADD CONSTRAINT "fk_pedido_items_tenant_pedido"
FOREIGN KEY ("tenantId", "pedidoId") REFERENCES "pedidos" ("tenantId", "id");

ALTER TABLE "pedido_items"
ADD CONSTRAINT "fk_pedido_items_tenant_producto"
FOREIGN KEY ("tenantId", "productoId") REFERENCES "productos" ("tenantId", "id");

ALTER TABLE "pedido_item_modificadores"
ADD CONSTRAINT "fk_pedido_item_mod_tenant_item"
FOREIGN KEY ("tenantId", "pedidoItemId") REFERENCES "pedido_items" ("tenantId", "id");

ALTER TABLE "pedido_item_modificadores"
ADD CONSTRAINT "fk_pedido_item_mod_tenant_modificador"
FOREIGN KEY ("tenantId", "modificadorId") REFERENCES "modificadores" ("tenantId", "id");

ALTER TABLE "pagos"
ADD CONSTRAINT "fk_pagos_tenant_pedido"
FOREIGN KEY ("tenantId", "pedidoId") REFERENCES "pedidos" ("tenantId", "id");

ALTER TABLE "cierres_caja"
ADD CONSTRAINT "fk_cierres_tenant_usuario"
FOREIGN KEY ("tenantId", "usuarioId") REFERENCES "usuarios" ("tenantId", "id");

ALTER TABLE "print_jobs"
ADD CONSTRAINT "fk_print_jobs_tenant_pedido"
FOREIGN KEY ("tenantId", "pedidoId") REFERENCES "pedidos" ("tenantId", "id");

ALTER TABLE "transacciones_mercadopago"
ADD CONSTRAINT "fk_trans_mp_tenant_pago"
FOREIGN KEY ("tenantId", "pagoId") REFERENCES "pagos" ("tenantId", "id");

ALTER TABLE "pagos_suscripcion"
ADD CONSTRAINT "fk_pago_suscripcion_tenant_suscripcion"
FOREIGN KEY ("tenantId", "suscripcionId") REFERENCES "suscripciones" ("tenantId", "id");

ALTER TABLE "refresh_tokens"
ADD CONSTRAINT "fk_refresh_tokens_tenant"
FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE;

-- ============================================
-- Additional data integrity constraints
-- ============================================
ALTER TABLE "ingredientes"
ADD CONSTRAINT "chk_ingrediente_costo_positivo"
CHECK ("costo" IS NULL OR "costo" >= 0);

ALTER TABLE "modificadores"
ADD CONSTRAINT "chk_modificador_precio_positivo"
CHECK ("precio" >= 0);

ALTER TABLE "pedidos"
ADD CONSTRAINT "chk_pedido_descuento_positivo"
CHECK ("descuento" >= 0);

ALTER TABLE "pedidos"
ADD CONSTRAINT "chk_pedido_costo_envio_positivo"
CHECK ("costoEnvio" >= 0);

ALTER TABLE "pedido_items"
ADD CONSTRAINT "chk_pedido_item_precio_unitario_positivo"
CHECK ("precioUnitario" >= 0);

ALTER TABLE "pedido_items"
ADD CONSTRAINT "chk_pedido_item_subtotal_positivo"
CHECK ("subtotal" >= 0);

ALTER TABLE "pedido_item_modificadores"
ADD CONSTRAINT "chk_pedido_item_mod_precio_positivo"
CHECK ("precio" >= 0);

ALTER TABLE "pagos"
ADD CONSTRAINT "chk_pago_monto_abonado_positivo"
CHECK ("montoAbonado" IS NULL OR "montoAbonado" >= 0);

ALTER TABLE "pagos"
ADD CONSTRAINT "chk_pago_vuelto_positivo"
CHECK ("vuelto" IS NULL OR "vuelto" >= 0);

ALTER TABLE "cierres_caja"
ADD CONSTRAINT "chk_cierre_total_efectivo_positivo"
CHECK ("totalEfectivo" >= 0);

ALTER TABLE "cierres_caja"
ADD CONSTRAINT "chk_cierre_total_tarjeta_positivo"
CHECK ("totalTarjeta" >= 0);

ALTER TABLE "cierres_caja"
ADD CONSTRAINT "chk_cierre_total_mp_positivo"
CHECK ("totalMP" >= 0);

ALTER TABLE "cierres_caja"
ADD CONSTRAINT "chk_cierre_efectivo_fisico_positivo"
CHECK ("efectivoFisico" IS NULL OR "efectivoFisico" >= 0);

ALTER TABLE "liquidaciones"
ADD CONSTRAINT "chk_liquidacion_horas_totales_positivas"
CHECK ("horasTotales" >= 0);

ALTER TABLE "liquidaciones"
ADD CONSTRAINT "chk_liquidacion_tarifa_hora_positiva"
CHECK ("tarifaHora" >= 0);

ALTER TABLE "liquidaciones"
ADD CONSTRAINT "chk_liquidacion_subtotal_positivo"
CHECK ("subtotal" >= 0);

ALTER TABLE "liquidaciones"
ADD CONSTRAINT "chk_liquidacion_descuentos_positivos"
CHECK ("descuentos" >= 0);

ALTER TABLE "liquidaciones"
ADD CONSTRAINT "chk_liquidacion_adicionales_positivos"
CHECK ("adicionales" >= 0);

ALTER TABLE "liquidaciones"
ADD CONSTRAINT "chk_liquidacion_total_pagar_positivo"
CHECK ("totalPagar" >= 0);

ALTER TABLE "pagos_suscripcion"
ADD CONSTRAINT "chk_pago_suscripcion_monto_positivo"
CHECK ("monto" >= 0);

ALTER TABLE "pagos_suscripcion"
ADD CONSTRAINT "chk_pago_suscripcion_comision_positiva"
CHECK ("comisionMp" IS NULL OR "comisionMp" >= 0);

ALTER TABLE "pagos_suscripcion"
ADD CONSTRAINT "chk_pago_suscripcion_monto_neto_positivo"
CHECK ("montoNeto" IS NULL OR "montoNeto" >= 0);
