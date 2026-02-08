# Print Bridge (Windows)

Servicio local para imprimir jobs desde el backend en cloud usando el spooler de Windows.

## Requisitos
- Windows 10+
- Node.js 18+
- Impresora instalada en Windows (ej: EPSON T2000 3I)

## Configuracion

Variables necesarias:

```
BRIDGE_API_URL=https://tu-dominio.com/api
BRIDGE_TOKEN=tu_token_seguro
BRIDGE_ID=pc-caja-1
PRINTER_NAME=EPSON T2000 3I
PRINT_ADAPTER=spooler
POLL_INTERVAL_MS=2000
```

## Ejecutar

```
node index.js
```

Para correr como servicio en Windows, se recomienda NSSM o PM2.
