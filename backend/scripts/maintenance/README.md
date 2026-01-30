# Scripts de Mantenimiento - GestioNeo

Scripts automatizados para mantenimiento de la base de datos y limpieza de datos obsoletos.

## Scripts Disponibles

### 1. cleanup-expired-tokens.js

Limpia tokens expirados de la base de datos para prevenir crecimiento innecesario de tablas.

**Limpia:**
- Refresh tokens expirados
- Refresh tokens revocados (antiguos de más de 30 días)
- Tokens de verificación de email expirados y sin usar
- Verificaciones de email usadas (antiguas de más de 90 días)

**Uso:**
```bash
node scripts/maintenance/cleanup-expired-tokens.js
```

**Recomendación:** Ejecutar diariamente vía cron
```bash
# Crontab: Ejecutar todos los días a las 2:00 AM
0 2 * * * cd /path/to/backend && node scripts/maintenance/cleanup-expired-tokens.js >> /var/log/gestioneo/token-cleanup.log 2>&1
```

### 2. release-stale-print-jobs.js

Libera trabajos de impresión bloqueados cuando una impresora muere o pierde conexión.

**Funcionamiento:**
- Busca jobs en estado `IMPRIMIENDO` por más del timeout configurado
- Si no alcanzó max intentos: libera a `PENDIENTE` para reintento
- Si alcanzó max intentos: marca como `ERROR`

**Uso:**
```bash
# Con timeout por defecto (5 minutos)
node scripts/maintenance/release-stale-print-jobs.js

# Con timeout personalizado (10 minutos)
node scripts/maintenance/release-stale-print-jobs.js 10
```

**Recomendación:** Ejecutar cada 5 minutos vía cron
```bash
# Crontab: Ejecutar cada 5 minutos
*/5 * * * * cd /path/to/backend && node scripts/maintenance/release-stale-print-jobs.js >> /var/log/gestioneo/print-jobs.log 2>&1
```

## Configuración de Cron Jobs

### Instalación Completa

1. Editar crontab:
```bash
crontab -e
```

2. Agregar las siguientes líneas:
```bash
# GestioNeo - Limpieza de tokens (diario a las 2 AM)
0 2 * * * cd /home/usuario/GestioNeo/backend && node scripts/maintenance/cleanup-expired-tokens.js >> /var/log/gestioneo/token-cleanup.log 2>&1

# GestioNeo - Liberar print jobs bloqueados (cada 5 minutos)
*/5 * * * * cd /home/usuario/GestioNeo/backend && node scripts/maintenance/release-stale-print-jobs.js >> /var/log/gestioneo/print-jobs.log 2>&1
```

3. Crear directorio de logs:
```bash
sudo mkdir -p /var/log/gestioneo
sudo chown usuario:usuario /var/log/gestioneo
```

### Verificar Cron Jobs

```bash
# Ver cron jobs activos
crontab -l

# Ver logs del sistema cron
sudo grep CRON /var/log/syslog
```

## Ejecución Manual

Para probar los scripts manualmente antes de configurar cron:

```bash
# Desde el directorio backend
cd /home/usuario/GestioNeo/backend

# Limpieza de tokens
node scripts/maintenance/cleanup-expired-tokens.js

# Liberar print jobs
node scripts/maintenance/release-stale-print-jobs.js
```

## Monitoreo

### Verificar Ejecución

```bash
# Ver últimas ejecuciones de limpieza de tokens
tail -f /var/log/gestioneo/token-cleanup.log

# Ver liberación de print jobs en tiempo real
tail -f /var/log/gestioneo/print-jobs.log
```

### Métricas de Limpieza

Los scripts reportan:
- ✅ Cantidad de registros eliminados
- 📊 Resumen total de operaciones
- ❌ Errores si ocurren

## Consideraciones de Seguridad

1. **Permisos de archivos:**
```bash
chmod +x scripts/maintenance/*.js
chmod 644 scripts/maintenance/README.md
```

2. **Variables de entorno:**
   - Asegurar que `DATABASE_URL` esté configurada
   - Los scripts usan la misma conexión que la aplicación

3. **Logs:**
   - Rotar logs periódicamente con `logrotate`
   - No exponer logs en directorios públicos

## Troubleshooting

### Script no ejecuta en cron

1. Verificar PATH en cron:
```bash
# Agregar al inicio del crontab
PATH=/usr/local/bin:/usr/bin:/bin
NODE_ENV=production
```

2. Verificar permisos del script:
```bash
ls -la scripts/maintenance/*.js
```

3. Probar ejecución manual con el PATH de cron:
```bash
env -i /bin/sh -c 'cd /path/to/backend && node scripts/maintenance/cleanup-expired-tokens.js'
```

### Error de conexión a base de datos

1. Verificar que `.env` existe y tiene `DATABASE_URL`
2. Probar conexión:
```bash
cd backend
npx prisma db execute --stdin < /dev/null
```

### Logs no se generan

1. Verificar permisos del directorio:
```bash
ls -ld /var/log/gestioneo
```

2. Crear si no existe:
```bash
sudo mkdir -p /var/log/gestioneo
sudo chown $USER:$USER /var/log/gestioneo
```

## Mejoras Futuras

- [ ] Agregar notificaciones por email en caso de errores
- [ ] Dashboard web para monitorear ejecuciones
- [ ] Exportar métricas a Prometheus/Grafana
- [ ] Script de backup antes de limpieza masiva
- [ ] Dry-run mode para testing
