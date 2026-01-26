-- Add missing indexes for frequently queried patterns
-- These improve performance on common queries

-- 1. Categoría: Index for filtering active/inactive categories
-- Used in public catalog queries (very frequent)
CREATE INDEX IF NOT EXISTS idx_categoria_tenantId_activa
ON categorias("tenantId", "activa");

-- 2. Liquidación: Index for employee payroll reports
-- Used in HR reports and payroll queries (frequent)
CREATE INDEX IF NOT EXISTS idx_liquidacion_tenantId_empleadoId
ON liquidaciones("tenantId", "empleadoId");

-- 3. Reserva: Index for pagination and date-based listing
-- Already exists in Pedido, missing in Reserva
CREATE INDEX IF NOT EXISTS idx_reserva_tenantId_createdAt
ON reservas("tenantId", "createdAt" DESC);

-- 4. Additional composite indexes for reporting queries (optional but recommended)
-- Pedido: For sales reports by date and status
CREATE INDEX IF NOT EXISTS idx_pedido_tenantId_createdAt_estado
ON pedidos("tenantId", "createdAt" DESC, "estado");

-- TransaccionMercadoPago: For payment transaction reports
CREATE INDEX IF NOT EXISTS idx_transaccion_mp_tenantId_createdAt_status
ON transacciones_mercadopago("tenantId", "createdAt" DESC, "status");

-- ============================================
-- DATA INTEGRITY CONSTRAINTS
-- ============================================

DO $$
BEGIN
  -- 5. Stock positivo: Prevent negative inventory
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_positivo'
  ) THEN
    ALTER TABLE ingredientes
    ADD CONSTRAINT chk_stock_positivo
    CHECK ("stockActual" >= 0);
  END IF;

  -- 6. Stock mínimo positivo: Minimum stock should also be positive
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_minimo_positivo'
  ) THEN
    ALTER TABLE ingredientes
    ADD CONSTRAINT chk_stock_minimo_positivo
    CHECK ("stockMinimo" >= 0);
  END IF;

  -- 7. Precios positivos: Ensure product prices are positive
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_precio_positivo'
  ) THEN
    ALTER TABLE productos
    ADD CONSTRAINT chk_precio_positivo
    CHECK ("precio" >= 0);
  END IF;

  -- 8. Modificador: EXCLUSION should have precio = 0
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_modificador_exclusion_sin_precio'
  ) THEN
    ALTER TABLE modificadores
    ADD CONSTRAINT chk_modificador_exclusion_sin_precio
    CHECK ("tipo" != 'EXCLUSION' OR "precio" = 0);
  END IF;

  -- 9. Pago: Amount must be positive
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_pago_monto_positivo'
  ) THEN
    ALTER TABLE pagos
    ADD CONSTRAINT chk_pago_monto_positivo
    CHECK ("monto" > 0);
  END IF;

  -- 10. CierreCaja: Fondo inicial must be positive or zero
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_fondo_inicial_positivo'
  ) THEN
    ALTER TABLE cierres_caja
    ADD CONSTRAINT chk_fondo_inicial_positivo
    CHECK ("fondoInicial" >= 0);
  END IF;

  -- 11. Pedido: Totals must be positive
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_pedido_subtotal_positivo'
  ) THEN
    ALTER TABLE pedidos
    ADD CONSTRAINT chk_pedido_subtotal_positivo
    CHECK ("subtotal" >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_pedido_total_positivo'
  ) THEN
    ALTER TABLE pedidos
    ADD CONSTRAINT chk_pedido_total_positivo
    CHECK ("total" >= 0);
  END IF;

  -- 12. PedidoItem: Cantidad must be positive
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_pedido_item_cantidad_positiva'
  ) THEN
    ALTER TABLE pedido_items
    ADD CONSTRAINT chk_pedido_item_cantidad_positiva
    CHECK ("cantidad" > 0);
  END IF;

  -- 13. Mesa: Capacidad must be positive
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_mesa_capacidad_positiva'
  ) THEN
    ALTER TABLE mesas
    ADD CONSTRAINT chk_mesa_capacidad_positiva
    CHECK ("capacidad" > 0);
  END IF;

  -- 14. Reserva: Cantidad de personas must be positive
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_reserva_personas_positiva'
  ) THEN
    ALTER TABLE reservas
    ADD CONSTRAINT chk_reserva_personas_positiva
    CHECK ("cantidadPersonas" > 0);
  END IF;
END $$;
