-- ============================================
-- DATOS DE PRUEBA PARA COMANDA
-- Ejecutar después del seed inicial
-- ============================================

-- Asumimos tenantId = 1 (creado por el seed)
-- Verificar IDs reales si es necesario

-- ============================================
-- 1. MODIFICADORES (Extras y Exclusiones)
-- ============================================

INSERT INTO modificadores ("tenantId", nombre, precio, tipo, activo, "createdAt", "updatedAt") VALUES
-- Exclusiones (precio 0)
(1, 'Sin cebolla', 0, 'EXCLUSION', true, NOW(), NOW()),
(1, 'Sin tomate', 0, 'EXCLUSION', true, NOW(), NOW()),
(1, 'Sin lechuga', 0, 'EXCLUSION', true, NOW(), NOW()),
(1, 'Sin mayonesa', 0, 'EXCLUSION', true, NOW(), NOW()),
(1, 'Sin mostaza', 0, 'EXCLUSION', true, NOW(), NOW()),
(1, 'Sin pepinillos', 0, 'EXCLUSION', true, NOW(), NOW()),
-- Adiciones (precio > 0)
(1, 'Extra queso', 500, 'ADICION', true, NOW(), NOW()),
(1, 'Extra bacon', 700, 'ADICION', true, NOW(), NOW()),
(1, 'Extra carne', 1200, 'ADICION', true, NOW(), NOW()),
(1, 'Huevo frito', 400, 'ADICION', true, NOW(), NOW()),
(1, 'Cebolla caramelizada', 350, 'ADICION', true, NOW(), NOW()),
(1, 'Jalapeños', 300, 'ADICION', true, NOW(), NOW()),
(1, 'Guacamole', 600, 'ADICION', true, NOW(), NOW()),
(1, 'Salsa BBQ', 200, 'ADICION', true, NOW(), NOW())
ON CONFLICT ("tenantId", nombre) DO NOTHING;

-- ============================================
-- 2. ASOCIAR MODIFICADORES A PRODUCTOS (Hamburguesas 1-4)
-- ============================================

INSERT INTO producto_modificadores ("tenantId", "productoId", "modificadorId")
SELECT 1, p.id, m.id
FROM productos p, modificadores m
WHERE p."tenantId" = 1
  AND m."tenantId" = 1
  AND p."categoriaId" = (SELECT id FROM categorias WHERE "tenantId" = 1 AND nombre = 'Hamburguesas')
ON CONFLICT ("tenantId", "productoId", "modificadorId") DO NOTHING;

-- ============================================
-- 3. ACTUALIZAR ESTADOS DE MESAS
-- ============================================

UPDATE mesas SET estado = 'OCUPADA' WHERE "tenantId" = 1 AND numero IN (1, 3, 5);
UPDATE mesas SET estado = 'RESERVADA' WHERE "tenantId" = 1 AND numero IN (2, 7);

-- ============================================
-- 4. RESERVAS DE MESAS
-- ============================================

INSERT INTO reservas ("tenantId", "mesaId", "clienteNombre", "clienteTelefono", "fechaHora", "cantidadPersonas", estado, observaciones, "createdAt", "updatedAt") VALUES
-- Reserva para hoy (confirmada)
(1, (SELECT id FROM mesas WHERE "tenantId" = 1 AND numero = 2), 'Carlos Fernández', '1155559876', NOW() + INTERVAL '2 hours', 4, 'CONFIRMADA', 'Cumpleaños', NOW(), NOW()),
-- Reserva para hoy más tarde
(1, (SELECT id FROM mesas WHERE "tenantId" = 1 AND numero = 7), 'María López', '1155558765', NOW() + INTERVAL '4 hours', 6, 'CONFIRMADA', 'Cena de negocios', NOW(), NOW()),
-- Reserva para mañana
(1, (SELECT id FROM mesas WHERE "tenantId" = 1 AND numero = 3), 'Roberto Sánchez', '1155557654', NOW() + INTERVAL '1 day', 4, 'CONFIRMADA', NULL, NOW(), NOW()),
-- Reserva pasada (cliente presente)
(1, (SELECT id FROM mesas WHERE "tenantId" = 1 AND numero = 5), 'Ana García', '1155556543', NOW() - INTERVAL '1 hour', 2, 'CLIENTE_PRESENTE', NULL, NOW(), NOW()),
-- Reserva cancelada
(1, (SELECT id FROM mesas WHERE "tenantId" = 1 AND numero = 4), 'Pedro Gómez', '1155555432', NOW() + INTERVAL '3 hours', 2, 'CANCELADA', 'Canceló por teléfono', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. PEDIDOS EN DIFERENTES ESTADOS Y TIPOS
-- ============================================

-- Obtener IDs de usuario y productos
DO $$
DECLARE
    v_mozo_id INT;
    v_admin_id INT;
    v_prod_clasica INT;
    v_prod_queso INT;
    v_prod_doble INT;
    v_prod_bacon INT;
    v_prod_papas INT;
    v_prod_papas_cheddar INT;
    v_prod_coca INT;
    v_prod_sprite INT;
    v_prod_agua INT;
    v_prod_brownie INT;
    v_prod_combo_clasico INT;
    v_prod_combo_doble INT;
    v_pedido_id INT;
BEGIN
    -- Obtener IDs de usuarios
    SELECT id INTO v_mozo_id FROM usuarios WHERE "tenantId" = 1 AND email = 'mozo@comanda.com';
    SELECT id INTO v_admin_id FROM usuarios WHERE "tenantId" = 1 AND email = 'admin@comanda.com';

    -- Obtener IDs de productos
    SELECT id INTO v_prod_clasica FROM productos WHERE "tenantId" = 1 AND nombre = 'Hamburguesa Clásica';
    SELECT id INTO v_prod_queso FROM productos WHERE "tenantId" = 1 AND nombre = 'Hamburguesa con Queso';
    SELECT id INTO v_prod_doble FROM productos WHERE "tenantId" = 1 AND nombre = 'Hamburguesa Doble';
    SELECT id INTO v_prod_bacon FROM productos WHERE "tenantId" = 1 AND nombre = 'Hamburguesa Bacon';
    SELECT id INTO v_prod_papas FROM productos WHERE "tenantId" = 1 AND nombre = 'Papas Fritas';
    SELECT id INTO v_prod_papas_cheddar FROM productos WHERE "tenantId" = 1 AND nombre = 'Papas con Cheddar';
    SELECT id INTO v_prod_coca FROM productos WHERE "tenantId" = 1 AND nombre = 'Coca-Cola 500ml';
    SELECT id INTO v_prod_sprite FROM productos WHERE "tenantId" = 1 AND nombre = 'Sprite 500ml';
    SELECT id INTO v_prod_agua FROM productos WHERE "tenantId" = 1 AND nombre = 'Agua Mineral 500ml';
    SELECT id INTO v_prod_brownie FROM productos WHERE "tenantId" = 1 AND nombre = 'Brownie con Helado';
    SELECT id INTO v_prod_combo_clasico FROM productos WHERE "tenantId" = 1 AND nombre = 'Combo Clásico';
    SELECT id INTO v_prod_combo_doble FROM productos WHERE "tenantId" = 1 AND nombre = 'Combo Doble';

    -- ============================================
    -- PEDIDO 1: Mesa 1 - EN_PREPARACION
    -- ============================================
    INSERT INTO pedidos ("tenantId", tipo, estado, "mesaId", "usuarioId", subtotal, total, "estadoPago", origen, "createdAt", "updatedAt")
    VALUES (1, 'MESA', 'EN_PREPARACION', (SELECT id FROM mesas WHERE "tenantId" = 1 AND numero = 1), v_mozo_id, 13200, 13200, 'PENDIENTE', 'INTERNO', NOW() - INTERVAL '15 minutes', NOW())
    RETURNING id INTO v_pedido_id;

    INSERT INTO pedido_items ("tenantId", "pedidoId", "productoId", cantidad, "precioUnitario", subtotal, "createdAt")
    VALUES
        (1, v_pedido_id, v_prod_doble, 2, 6500, 13000, NOW()),
        (1, v_pedido_id, v_prod_coca, 2, 1200, 2400, NOW());

    -- ============================================
    -- PEDIDO 2: Mesa 3 - LISTO (para entregar)
    -- ============================================
    INSERT INTO pedidos ("tenantId", tipo, estado, "mesaId", "usuarioId", subtotal, total, "estadoPago", origen, "createdAt", "updatedAt")
    VALUES (1, 'MESA', 'LISTO', (SELECT id FROM mesas WHERE "tenantId" = 1 AND numero = 3), v_mozo_id, 19500, 19500, 'PENDIENTE', 'INTERNO', NOW() - INTERVAL '25 minutes', NOW())
    RETURNING id INTO v_pedido_id;

    INSERT INTO pedido_items ("tenantId", "pedidoId", "productoId", cantidad, "precioUnitario", subtotal, observaciones, "createdAt")
    VALUES
        (1, v_pedido_id, v_prod_combo_doble, 2, 9500, 19000, NULL, NOW()),
        (1, v_pedido_id, v_prod_papas, 1, 1800, 1800, 'Sin sal', NOW());

    -- ============================================
    -- PEDIDO 3: Mesa 5 - ENTREGADO (pendiente de cobro)
    -- ============================================
    INSERT INTO pedidos ("tenantId", tipo, estado, "mesaId", "usuarioId", subtotal, total, "estadoPago", origen, "createdAt", "updatedAt")
    VALUES (1, 'MESA', 'ENTREGADO', (SELECT id FROM mesas WHERE "tenantId" = 1 AND numero = 5), v_mozo_id, 8100, 8100, 'PENDIENTE', 'INTERNO', NOW() - INTERVAL '45 minutes', NOW())
    RETURNING id INTO v_pedido_id;

    INSERT INTO pedido_items ("tenantId", "pedidoId", "productoId", cantidad, "precioUnitario", subtotal, "createdAt")
    VALUES
        (1, v_pedido_id, v_prod_clasica, 1, 4500, 4500, NOW()),
        (1, v_pedido_id, v_prod_papas, 1, 1800, 1800, NOW()),
        (1, v_pedido_id, v_prod_coca, 1, 1200, 1200, NOW()),
        (1, v_pedido_id, v_prod_agua, 1, 800, 800, NOW());

    -- ============================================
    -- PEDIDO 4: DELIVERY - PENDIENTE
    -- ============================================
    INSERT INTO pedidos ("tenantId", tipo, estado, "mesaId", "usuarioId", "clienteNombre", "clienteTelefono", "clienteDireccion", "tipoEntrega", "costoEnvio", subtotal, total, "estadoPago", origen, "createdAt", "updatedAt")
    VALUES (1, 'DELIVERY', 'PENDIENTE', NULL, NULL, 'Laura Martínez', '1155551111', 'Av. Corrientes 1234, Piso 5', 'DELIVERY', 500, 14000, 14500, 'PENDIENTE', 'MENU_PUBLICO', NOW() - INTERVAL '5 minutes', NOW())
    RETURNING id INTO v_pedido_id;

    INSERT INTO pedido_items ("tenantId", "pedidoId", "productoId", cantidad, "precioUnitario", subtotal, observaciones, "createdAt")
    VALUES
        (1, v_pedido_id, v_prod_combo_clasico, 2, 6800, 13600, 'Una sin cebolla', NOW()),
        (1, v_pedido_id, v_prod_brownie, 1, 2500, 2500, NULL, NOW());

    -- ============================================
    -- PEDIDO 5: DELIVERY - EN_PREPARACION
    -- ============================================
    INSERT INTO pedidos ("tenantId", tipo, estado, "mesaId", "usuarioId", "clienteNombre", "clienteTelefono", "clienteDireccion", "tipoEntrega", "costoEnvio", subtotal, total, "estadoPago", origen, "createdAt", "updatedAt")
    VALUES (1, 'DELIVERY', 'EN_PREPARACION', NULL, v_mozo_id, 'Diego Rodríguez', '1155552222', 'Calle Falsa 123', 'DELIVERY', 500, 11500, 12000, 'APROBADO', 'MENU_PUBLICO', NOW() - INTERVAL '20 minutes', NOW())
    RETURNING id INTO v_pedido_id;

    INSERT INTO pedido_items ("tenantId", "pedidoId", "productoId", cantidad, "precioUnitario", subtotal, "createdAt")
    VALUES
        (1, v_pedido_id, v_prod_bacon, 2, 5500, 11000, NOW()),
        (1, v_pedido_id, v_prod_sprite, 2, 1200, 2400, NOW());

    -- ============================================
    -- PEDIDO 6: MOSTRADOR - PENDIENTE
    -- ============================================
    INSERT INTO pedidos ("tenantId", tipo, estado, "mesaId", "usuarioId", "clienteNombre", "tipoEntrega", subtotal, total, "estadoPago", origen, "createdAt", "updatedAt")
    VALUES (1, 'MOSTRADOR', 'PENDIENTE', NULL, v_mozo_id, 'Cliente Mostrador', 'RETIRO', 7300, 7300, 'PENDIENTE', 'INTERNO', NOW() - INTERVAL '3 minutes', NOW())
    RETURNING id INTO v_pedido_id;

    INSERT INTO pedido_items ("tenantId", "pedidoId", "productoId", cantidad, "precioUnitario", subtotal, "createdAt")
    VALUES
        (1, v_pedido_id, v_prod_queso, 1, 5000, 5000, NOW()),
        (1, v_pedido_id, v_prod_papas_cheddar, 1, 2500, 2500, NOW());

    -- ============================================
    -- PEDIDO 7: COBRADO (histórico de hoy) - Efectivo
    -- ============================================
    INSERT INTO pedidos ("tenantId", tipo, estado, "mesaId", "usuarioId", subtotal, total, "estadoPago", origen, "createdAt", "updatedAt")
    VALUES (1, 'MESA', 'COBRADO', (SELECT id FROM mesas WHERE "tenantId" = 1 AND numero = 4), v_mozo_id, 15800, 15800, 'APROBADO', 'INTERNO', NOW() - INTERVAL '2 hours', NOW())
    RETURNING id INTO v_pedido_id;

    INSERT INTO pedido_items ("tenantId", "pedidoId", "productoId", cantidad, "precioUnitario", subtotal, "createdAt")
    VALUES
        (1, v_pedido_id, v_prod_combo_clasico, 1, 6800, 6800, NOW()),
        (1, v_pedido_id, v_prod_combo_doble, 1, 9500, 9500, NOW());

    INSERT INTO pagos ("tenantId", "pedidoId", monto, metodo, estado, "montoAbonado", vuelto, "createdAt", "updatedAt")
    VALUES (1, v_pedido_id, 15800, 'EFECTIVO', 'APROBADO', 20000, 4200, NOW() - INTERVAL '2 hours', NOW());

    -- ============================================
    -- PEDIDO 8: COBRADO (histórico de hoy) - Tarjeta
    -- ============================================
    INSERT INTO pedidos ("tenantId", tipo, estado, "mesaId", "usuarioId", subtotal, total, "estadoPago", origen, "createdAt", "updatedAt")
    VALUES (1, 'MESA', 'COBRADO', (SELECT id FROM mesas WHERE "tenantId" = 1 AND numero = 6), v_mozo_id, 22000, 22000, 'APROBADO', 'INTERNO', NOW() - INTERVAL '3 hours', NOW())
    RETURNING id INTO v_pedido_id;

    INSERT INTO pedido_items ("tenantId", "pedidoId", "productoId", cantidad, "precioUnitario", subtotal, "createdAt")
    VALUES
        (1, v_pedido_id, v_prod_doble, 2, 6500, 13000, NOW()),
        (1, v_pedido_id, v_prod_bacon, 1, 5500, 5500, NOW()),
        (1, v_pedido_id, v_prod_papas_cheddar, 2, 2500, 5000, NOW()),
        (1, v_pedido_id, v_prod_brownie, 2, 2500, 5000, NOW());

    INSERT INTO pagos ("tenantId", "pedidoId", monto, metodo, estado, referencia, "createdAt", "updatedAt")
    VALUES (1, v_pedido_id, 22000, 'TARJETA', 'APROBADO', 'TXN-2024-001234', NOW() - INTERVAL '3 hours', NOW());

    -- ============================================
    -- PEDIDO 9: COBRADO (histórico de ayer)
    -- ============================================
    INSERT INTO pedidos ("tenantId", tipo, estado, "mesaId", "usuarioId", subtotal, total, "estadoPago", origen, "createdAt", "updatedAt")
    VALUES (1, 'MOSTRADOR', 'COBRADO', NULL, v_admin_id, 6800, 6800, 'APROBADO', 'INTERNO', NOW() - INTERVAL '1 day', NOW())
    RETURNING id INTO v_pedido_id;

    INSERT INTO pedido_items ("tenantId", "pedidoId", "productoId", cantidad, "precioUnitario", subtotal, "createdAt")
    VALUES
        (1, v_pedido_id, v_prod_combo_clasico, 1, 6800, 6800, NOW() - INTERVAL '1 day');

    INSERT INTO pagos ("tenantId", "pedidoId", monto, metodo, estado, "createdAt", "updatedAt")
    VALUES (1, v_pedido_id, 6800, 'EFECTIVO', 'APROBADO', NOW() - INTERVAL '1 day', NOW());

    -- ============================================
    -- PEDIDO 10: CANCELADO
    -- ============================================
    INSERT INTO pedidos ("tenantId", tipo, estado, "mesaId", "usuarioId", subtotal, total, "estadoPago", origen, observaciones, "createdAt", "updatedAt")
    VALUES (1, 'DELIVERY', 'CANCELADO', NULL, NULL, 9500, 10000, 'CANCELADO', 'MENU_PUBLICO', 'Cliente canceló - no encontraba la dirección', NOW() - INTERVAL '4 hours', NOW())
    RETURNING id INTO v_pedido_id;

    INSERT INTO pedido_items ("tenantId", "pedidoId", "productoId", cantidad, "precioUnitario", subtotal, "createdAt")
    VALUES
        (1, v_pedido_id, v_prod_combo_doble, 1, 9500, 9500, NOW() - INTERVAL '4 hours');

END $$;

-- ============================================
-- 6. FICHAJES DE EMPLEADOS (Últimos días)
-- ============================================

INSERT INTO fichajes ("tenantId", "empleadoId", entrada, salida, fecha, "createdAt")
SELECT
    1,
    e.id,
    (CURRENT_DATE - INTERVAL '2 days') + TIME '09:00:00',
    (CURRENT_DATE - INTERVAL '2 days') + TIME '17:30:00',
    CURRENT_DATE - INTERVAL '2 days',
    NOW()
FROM empleados e WHERE e."tenantId" = 1 AND e.dni IN ('30123456', '32345678')
ON CONFLICT DO NOTHING;

INSERT INTO fichajes ("tenantId", "empleadoId", entrada, salida, fecha, "createdAt")
SELECT
    1,
    e.id,
    (CURRENT_DATE - INTERVAL '2 days') + TIME '17:00:00',
    (CURRENT_DATE - INTERVAL '2 days') + TIME '23:30:00',
    CURRENT_DATE - INTERVAL '2 days',
    NOW()
FROM empleados e WHERE e."tenantId" = 1 AND e.dni IN ('31234567', '33456789')
ON CONFLICT DO NOTHING;

-- Fichajes de ayer
INSERT INTO fichajes ("tenantId", "empleadoId", entrada, salida, fecha, "createdAt")
SELECT
    1,
    e.id,
    (CURRENT_DATE - INTERVAL '1 day') + TIME '10:00:00',
    (CURRENT_DATE - INTERVAL '1 day') + TIME '18:00:00',
    CURRENT_DATE - INTERVAL '1 day',
    NOW()
FROM empleados e WHERE e."tenantId" = 1 AND e.dni IN ('30123456', '31234567')
ON CONFLICT DO NOTHING;

INSERT INTO fichajes ("tenantId", "empleadoId", entrada, salida, fecha, "createdAt")
SELECT
    1,
    e.id,
    (CURRENT_DATE - INTERVAL '1 day') + TIME '12:00:00',
    (CURRENT_DATE - INTERVAL '1 day') + TIME '22:00:00',
    CURRENT_DATE - INTERVAL '1 day',
    NOW()
FROM empleados e WHERE e."tenantId" = 1 AND e.dni IN ('32345678', '33456789')
ON CONFLICT DO NOTHING;

-- Fichajes de hoy (algunos sin salida = están trabajando)
INSERT INTO fichajes ("tenantId", "empleadoId", entrada, salida, fecha, "createdAt")
SELECT
    1,
    e.id,
    CURRENT_DATE + TIME '09:00:00',
    NULL, -- Todavía trabajando
    CURRENT_DATE,
    NOW()
FROM empleados e WHERE e."tenantId" = 1 AND e.dni = '30123456'
ON CONFLICT DO NOTHING;

INSERT INTO fichajes ("tenantId", "empleadoId", entrada, salida, fecha, "createdAt")
SELECT
    1,
    e.id,
    CURRENT_DATE + TIME '11:00:00',
    NULL, -- Todavía trabajando
    CURRENT_DATE,
    NOW()
FROM empleados e WHERE e."tenantId" = 1 AND e.dni = '32345678'
ON CONFLICT DO NOTHING;

-- ============================================
-- 7. LIQUIDACIONES (Mes anterior)
-- ============================================

INSERT INTO liquidaciones ("tenantId", "empleadoId", "periodoDesde", "periodoHasta", "horasTotales", "tarifaHora", subtotal, descuentos, adicionales, "totalPagar", observaciones, pagado, "fechaPago", "createdAt")
SELECT
    1,
    e.id,
    DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')::DATE,
    (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day')::DATE,
    160.00,
    e."tarifaHora",
    160.00 * e."tarifaHora",
    0,
    5000, -- Adicional por horas extras
    (160.00 * e."tarifaHora") + 5000,
    'Incluye horas extras fin de semana',
    true,
    DATE_TRUNC('month', CURRENT_DATE)::DATE + INTERVAL '5 days',
    NOW()
FROM empleados e WHERE e."tenantId" = 1 AND e.dni = '30123456'
ON CONFLICT DO NOTHING;

INSERT INTO liquidaciones ("tenantId", "empleadoId", "periodoDesde", "periodoHasta", "horasTotales", "tarifaHora", subtotal, descuentos, adicionales, "totalPagar", observaciones, pagado, "fechaPago", "createdAt")
SELECT
    1,
    e.id,
    DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')::DATE,
    (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day')::DATE,
    140.00,
    e."tarifaHora",
    140.00 * e."tarifaHora",
    10000, -- Descuento por adelanto
    0,
    (140.00 * e."tarifaHora") - 10000,
    'Descuento adelanto del día 15',
    true,
    DATE_TRUNC('month', CURRENT_DATE)::DATE + INTERVAL '5 days',
    NOW()
FROM empleados e WHERE e."tenantId" = 1 AND e.dni = '32345678'
ON CONFLICT DO NOTHING;

-- ============================================
-- 8. MOVIMIENTOS DE STOCK
-- ============================================

-- Entradas de stock (compras)
INSERT INTO movimientos_stock ("tenantId", "ingredienteId", tipo, cantidad, motivo, "createdAt")
SELECT 1, i.id, 'ENTRADA', 50, 'Compra proveedor - Factura A-0001-00012345', NOW() - INTERVAL '3 days'
FROM ingredientes i WHERE i."tenantId" = 1 AND i.nombre = 'Carne de hamburguesa'
ON CONFLICT DO NOTHING;

INSERT INTO movimientos_stock ("tenantId", "ingredienteId", tipo, cantidad, motivo, "createdAt")
SELECT 1, i.id, 'ENTRADA', 100, 'Compra proveedor - Factura A-0001-00012345', NOW() - INTERVAL '3 days'
FROM ingredientes i WHERE i."tenantId" = 1 AND i.nombre = 'Pan de hamburguesa'
ON CONFLICT DO NOTHING;

INSERT INTO movimientos_stock ("tenantId", "ingredienteId", tipo, cantidad, motivo, "createdAt")
SELECT 1, i.id, 'ENTRADA', 24, 'Compra proveedor - Bebidas', NOW() - INTERVAL '2 days'
FROM ingredientes i WHERE i."tenantId" = 1 AND i.nombre = 'Coca-Cola'
ON CONFLICT DO NOTHING;

-- Salidas por ventas (simuladas)
INSERT INTO movimientos_stock ("tenantId", "ingredienteId", tipo, cantidad, motivo, "createdAt")
SELECT 1, i.id, 'SALIDA', 15, 'Consumo diario', NOW() - INTERVAL '1 day'
FROM ingredientes i WHERE i."tenantId" = 1 AND i.nombre = 'Carne de hamburguesa'
ON CONFLICT DO NOTHING;

INSERT INTO movimientos_stock ("tenantId", "ingredienteId", tipo, cantidad, motivo, "createdAt")
SELECT 1, i.id, 'SALIDA', 15, 'Consumo diario', NOW() - INTERVAL '1 day'
FROM ingredientes i WHERE i."tenantId" = 1 AND i.nombre = 'Pan de hamburguesa'
ON CONFLICT DO NOTHING;

-- Ajustes de inventario
INSERT INTO movimientos_stock ("tenantId", "ingredienteId", tipo, cantidad, motivo, "createdAt")
SELECT 1, i.id, 'AJUSTE', -5, 'Ajuste por merma - productos vencidos', NOW() - INTERVAL '1 day'
FROM ingredientes i WHERE i."tenantId" = 1 AND i.nombre = 'Lechuga'
ON CONFLICT DO NOTHING;

INSERT INTO movimientos_stock ("tenantId", "ingredienteId", tipo, cantidad, motivo, "createdAt")
SELECT 1, i.id, 'AJUSTE', -3, 'Ajuste inventario físico', NOW()
FROM ingredientes i WHERE i."tenantId" = 1 AND i.nombre = 'Queso cheddar'
ON CONFLICT DO NOTHING;

-- ============================================
-- 9. CIERRE DE CAJA (Ayer)
-- ============================================

INSERT INTO cierres_caja ("tenantId", "usuarioId", fecha, "horaApertura", "horaCierre", "fondoInicial", "totalEfectivo", "totalTarjeta", "totalMP", "efectivoFisico", diferencia, estado, observaciones, "createdAt", "updatedAt")
SELECT
    1,
    u.id,
    (CURRENT_DATE - INTERVAL '1 day')::DATE,
    (CURRENT_DATE - INTERVAL '1 day') + TIME '10:00:00',
    (CURRENT_DATE - INTERVAL '1 day') + TIME '23:00:00',
    10000.00, -- Fondo inicial
    85600.00, -- Total efectivo
    45000.00, -- Total tarjeta
    32000.00, -- Total MercadoPago
    95100.00, -- Efectivo contado (fondo + ventas efectivo - vueltos)
    -500.00,  -- Diferencia (faltante)
    'CERRADO',
    'Faltante de $500, revisar vueltos',
    NOW(),
    NOW()
FROM usuarios u WHERE u."tenantId" = 1 AND u.email = 'admin@comanda.com'
ON CONFLICT DO NOTHING;

-- Cierre de caja de hoy (abierto)
INSERT INTO cierres_caja ("tenantId", "usuarioId", fecha, "horaApertura", "horaCierre", "fondoInicial", "totalEfectivo", "totalTarjeta", "totalMP", estado, "createdAt", "updatedAt")
SELECT
    1,
    u.id,
    CURRENT_DATE,
    CURRENT_DATE + TIME '09:00:00',
    NULL, -- No cerrado aún
    10000.00,
    37800.00, -- Acumulado hasta ahora
    22000.00,
    0.00,
    'ABIERTO',
    NOW(),
    NOW()
FROM usuarios u WHERE u."tenantId" = 1 AND u.email = 'admin@comanda.com'
ON CONFLICT DO NOTHING;

-- ============================================
-- 10. ACTUALIZAR STOCK ACTUAL (reflejar movimientos)
-- ============================================

UPDATE ingredientes SET "stockActual" = "stockActual" - 10 WHERE "tenantId" = 1 AND nombre = 'Carne de hamburguesa';
UPDATE ingredientes SET "stockActual" = "stockActual" - 10 WHERE "tenantId" = 1 AND nombre = 'Pan de hamburguesa';
UPDATE ingredientes SET "stockActual" = "stockActual" - 20 WHERE "tenantId" = 1 AND nombre = 'Queso cheddar';
UPDATE ingredientes SET "stockActual" = "stockActual" - 8 WHERE "tenantId" = 1 AND nombre = 'Bacon';
UPDATE ingredientes SET "stockActual" = "stockActual" - 15 WHERE "tenantId" = 1 AND nombre = 'Lechuga';
UPDATE ingredientes SET "stockActual" = "stockActual" - 5 WHERE "tenantId" = 1 AND nombre = 'Papas';
UPDATE ingredientes SET "stockActual" = "stockActual" - 12 WHERE "tenantId" = 1 AND nombre = 'Coca-Cola';
UPDATE ingredientes SET "stockActual" = "stockActual" - 6 WHERE "tenantId" = 1 AND nombre = 'Sprite';

-- Poner algunos ingredientes en stock bajo (para alertas)
UPDATE ingredientes SET "stockActual" = 18 WHERE "tenantId" = 1 AND nombre = 'Bacon';
UPDATE ingredientes SET "stockActual" = 8 WHERE "tenantId" = 1 AND nombre = 'Papas';

-- ============================================
-- 11. CONFIGURACIONES ADICIONALES
-- ============================================

INSERT INTO configuraciones ("tenantId", clave, valor, "updatedAt") VALUES
(1, 'horario_apertura', '10:00', NOW()),
(1, 'horario_cierre', '23:00', NOW()),
(1, 'costo_envio_default', '500', NOW()),
(1, 'radio_delivery_km', '5', NOW()),
(1, 'tiempo_preparacion_min', '20', NOW()),
(1, 'acepta_reservas', 'true', NOW()),
(1, 'max_personas_reserva', '10', NOW()),
(1, 'iva_porcentaje', '21', NOW())
ON CONFLICT ("tenantId", clave) DO UPDATE SET valor = EXCLUDED.valor;

-- ============================================
-- RESUMEN DE DATOS CREADOS
-- ============================================
-- Modificadores: 14 (6 exclusiones + 8 adiciones)
-- Reservas: 5 (diferentes estados)
-- Pedidos: 10 (diferentes tipos y estados)
-- Fichajes: ~10 registros (últimos 3 días)
-- Liquidaciones: 2 (mes anterior)
-- Movimientos stock: 8
-- Cierres caja: 2 (ayer cerrado, hoy abierto)
-- Configuraciones adicionales: 8

SELECT 'Datos de prueba insertados correctamente' as resultado;
