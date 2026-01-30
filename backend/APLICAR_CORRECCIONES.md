# Guía de Aplicación de Correcciones - Auditoría DB

Este documento describe cómo aplicar todas las correcciones identificadas en la auditoría de base de datos.

## 📋 Resumen de Correcciones

Se han creado:
- ✅ 3 migrations críticas (enums y constraints)
- ✅ 2 scripts de mantenimiento automático
- ✅ Documentación completa

## 🚨 PASO 1: Backup de Base de Datos (CRÍTICO)

**IMPORTANTE:** Antes de aplicar las migrations, crear un backup completo.

```bash
# PostgreSQL backup
pg_dump -h localhost -U usuario -d comanda > backup_pre_audit_$(date +%Y%m%d_%H%M%S).sql

# O si usas Supabase
# Hacer backup desde el dashboard de Supabase
```

## 🔧 PASO 2: Verificar Estado Actual

```bash
cd /home/zet/Comanda/backend

# Verificar estado de migrations
npx prisma migrate status

# Debería mostrar las 3 nuevas migrations como pendientes:
# - 20260126000001_fix_enum_tipo_pedido
# - 20260126000002_add_enum_estado_suscripcion
# - 20260126000003_add_missing_indexes_and_constraints
```

## 🚀 PASO 3: Aplicar Migrations

### Opción A: Entorno de Desarrollo

```bash
cd /home/zet/Comanda/backend

# Aplicar todas las migrations pendientes
npx prisma migrate deploy

# Verificar que se aplicaron correctamente
npx prisma migrate status
```

### Opción B: Entorno de Producción

```bash
cd /home/zet/Comanda/backend

# 1. Revisar las migrations antes de aplicar
cat prisma/migrations/20260126000001_fix_enum_tipo_pedido/migration.sql
cat prisma/migrations/20260126000002_add_enum_estado_suscripcion/migration.sql
cat prisma/migrations/20260126000003_add_missing_indexes_and_constraints/migration.sql

# 2. Aplicar migrations
NODE_ENV=production npx prisma migrate deploy

# 3. Verificar estado
npx prisma migrate status
```

### Aplicación Manual (Alternativa)

Si prefieres aplicar manualmente vía psql:

```bash
# Conectar a la base de datos
psql -h localhost -U usuario -d comanda

# Ejecutar migration 1
\i prisma/migrations/20260126000001_fix_enum_tipo_pedido/migration.sql

# Ejecutar migration 2
\i prisma/migrations/20260126000002_add_enum_estado_suscripcion/migration.sql

# Ejecutar migration 3
\i prisma/migrations/20260126000003_add_missing_indexes_and_constraints/migration.sql

# Salir
\q
```

## ✅ PASO 4: Verificación Post-Migration

### 4.1 Verificar Enums

```bash
# Conectar a psql
psql -h localhost -U usuario -d comanda

# Verificar TipoPedido tiene ONLINE
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'TipoPedido'::regtype ORDER BY enumsortorder;

# Debería mostrar: MESA, DELIVERY, MOSTRADOR, ONLINE

# Verificar EstadoSuscripcion existe
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'EstadoSuscripcion'::regtype ORDER BY enumsortorder;

# Debería mostrar: PENDIENTE, ACTIVA, MOROSA, CANCELADA
```

### 4.2 Verificar Índices

```sql
-- Verificar índices creados
SELECT tablename, indexname
FROM pg_indexes
WHERE tablename IN ('categorias', 'liquidaciones', 'reservas', 'pedidos', 'transacciones_mercadopago')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Debería mostrar:
-- categorias | idx_categoria_tenantId_activa
-- liquidaciones | idx_liquidacion_tenantId_empleadoId
-- reservas | idx_reserva_tenantId_createdAt
-- pedidos | idx_pedido_tenantId_createdAt_estado
-- transacciones_mercadopago | idx_transaccion_mp_tenantId_createdAt_status
```

### 4.3 Verificar Constraints

```sql
-- Verificar constraints de stock y precios
SELECT conname, contype
FROM pg_constraint
WHERE conrelid IN (
  'ingredientes'::regclass,
  'productos'::regclass,
  'modificadores'::regclass,
  'pagos'::regclass
)
AND contype = 'c'  -- CHECK constraints
ORDER BY conname;

-- Debería incluir:
-- chk_stock_positivo
-- chk_stock_minimo_positivo
-- chk_precio_positivo
-- chk_modificador_exclusion_sin_precio
-- chk_pago_monto_positivo
-- etc.
```

## 🧪 PASO 5: Pruebas Funcionales

### 5.1 Probar Pedido ONLINE

```javascript
// En Node.js REPL o script de test
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    // Crear pedido ONLINE (antes fallaba)
    const pedido = await prisma.pedido.create({
      data: {
        tenantId: 1,
        tipo: 'ONLINE',  // ✅ Ahora debe funcionar
        estado: 'PENDIENTE',
        subtotal: 1000,
        total: 1000,
        origen: 'MENU_PUBLICO'
      }
    });
    console.log('✅ Pedido ONLINE creado:', pedido.id);

    // Limpiar test
    await prisma.pedido.delete({ where: { id: pedido.id } });
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
```

### 5.2 Probar Suscripción

```javascript
// Crear suscripción con estado (antes fallaba)
const suscripcion = await prisma.suscripcion.create({
  data: {
    tenantId: 1,
    estado: 'ACTIVA',  // ✅ Ahora debe funcionar
    precioMensual: 37000
  }
});
console.log('✅ Suscripción creada:', suscripcion.id);
```

### 5.3 Probar Constraint de Stock

```javascript
// Intentar stock negativo (debe fallar)
try {
  await prisma.ingrediente.update({
    where: { id: 1 },
    data: { stockActual: -10 }
  });
  console.log('❌ ERROR: Stock negativo permitido!');
} catch (error) {
  console.log('✅ Constraint funciona:', error.message);
  // Debería contener "chk_stock_positivo"
}
```

## 📅 PASO 6: Configurar Scripts de Mantenimiento

### 6.1 Probar Scripts Manualmente

```bash
# Test 1: Limpieza de tokens
cd /home/zet/Comanda/backend
node scripts/maintenance/cleanup-expired-tokens.js

# Test 2: Liberar print jobs
node scripts/maintenance/release-stale-print-jobs.js

# Test 3: Con timeout personalizado
node scripts/maintenance/release-stale-print-jobs.js 10
```

### 6.2 Configurar Cron Jobs

```bash
# Editar crontab
crontab -e

# Agregar estas líneas (ajustar rutas según tu instalación):
# Limpieza de tokens (diario a las 2 AM)
0 2 * * * cd /home/zet/Comanda/backend && node scripts/maintenance/cleanup-expired-tokens.js >> /var/log/comanda/token-cleanup.log 2>&1

# Liberar print jobs (cada 5 minutos)
*/5 * * * * cd /home/zet/Comanda/backend && node scripts/maintenance/release-stale-print-jobs.js >> /var/log/comanda/print-jobs.log 2>&1
```

### 6.3 Crear Directorio de Logs

```bash
sudo mkdir -p /var/log/comanda
sudo chown $USER:$USER /var/log/comanda
```

## 📊 PASO 7: Monitoreo Post-Aplicación

### Verificar Performance de Índices

```sql
-- Verificar uso de índices
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE tablename IN ('categorias', 'liquidaciones', 'reservas')
ORDER BY idx_scan DESC;

-- Debería mostrar incremento en idx_scan después de algunos días
```

### Verificar Tamaño de Tablas

```sql
-- Antes y después de limpieza de tokens
SELECT
  relname AS table_name,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  pg_size_pretty(pg_relation_size(relid)) AS table_size
FROM pg_catalog.pg_statio_user_tables
WHERE relname IN ('refresh_tokens', 'email_verificaciones')
ORDER BY pg_total_relation_size(relid) DESC;
```

## 🔄 Rollback (En caso de problemas)

Si algo sale mal, restaurar el backup:

```bash
# Detener aplicación
# ... comando según tu setup (pm2 stop, systemctl stop, etc.)

# Restaurar backup
psql -h localhost -U usuario -d comanda < backup_pre_audit_YYYYMMDD_HHMMSS.sql

# Reiniciar aplicación
# ... comando según tu setup
```

## 📝 Checklist Final

- [ ] Backup creado y verificado
- [ ] Estado de migrations verificado
- [ ] 3 migrations aplicadas correctamente
- [ ] Enum TipoPedido incluye 'ONLINE'
- [ ] Enum EstadoSuscripcion creado
- [ ] 5 índices nuevos creados
- [ ] 14 constraints de integridad agregados
- [ ] Pedido ONLINE probado exitosamente
- [ ] Suscripción con estado probada
- [ ] Constraint de stock probado
- [ ] Scripts de mantenimiento probados manualmente
- [ ] Cron jobs configurados
- [ ] Directorio de logs creado
- [ ] Monitoreo de logs configurado

## 🎯 Resultados Esperados

Después de aplicar todas las correcciones:

1. ✅ **Pedidos online funcionando** - Menú público puede crear pedidos tipo ONLINE
2. ✅ **Sistema de suscripciones funcional** - Estados PENDIENTE/ACTIVA/MOROSA/CANCELADA
3. ✅ **Mejor performance** - Queries optimizadas con índices compuestos
4. ✅ **Integridad de datos** - Constraints previenen datos inválidos (stock negativo, precios negativos, etc.)
5. ✅ **Limpieza automática** - Tokens y print jobs se limpian automáticamente
6. ✅ **Base de datos más limpia** - Sin crecimiento innecesario de tablas

## 📞 Soporte

Si encuentras problemas:

1. Revisar logs de Prisma: `backend/prisma/logs/`
2. Revisar logs de aplicación: `backend/logs/`
3. Verificar variables de entorno: `backend/.env`
4. Contactar al equipo de desarrollo

---

**Fecha de creación:** 2026-01-26
**Versión:** 1.0
**Estado:** Listo para aplicar
