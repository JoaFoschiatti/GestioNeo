-- CreateEnum
CREATE TYPE "PlanTenant" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MOZO', 'COCINERO', 'CAJERO', 'DELIVERY');

-- CreateEnum
CREATE TYPE "EstadoMesa" AS ENUM ('LIBRE', 'OCUPADA', 'RESERVADA');

-- CreateEnum
CREATE TYPE "TipoPedido" AS ENUM ('MESA', 'DELIVERY', 'MOSTRADOR');

-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('PENDIENTE', 'EN_PREPARACION', 'LISTO', 'ENTREGADO', 'COBRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'MERCADOPAGO', 'TARJETA');

-- CreateEnum
CREATE TYPE "TipoMovimientoStock" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoEntrega" AS ENUM ('DELIVERY', 'RETIRO');

-- CreateEnum
CREATE TYPE "OrigenPedido" AS ENUM ('INTERNO', 'MENU_PUBLICO');

-- CreateEnum
CREATE TYPE "TipoComanda" AS ENUM ('COCINA', 'CAJA', 'CLIENTE');

-- CreateEnum
CREATE TYPE "EstadoPrintJob" AS ENUM ('PENDIENTE', 'IMPRIMIENDO', 'OK', 'ERROR');

-- CreateEnum
CREATE TYPE "EstadoCaja" AS ENUM ('ABIERTO', 'CERRADO');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('CONFIRMADA', 'CLIENTE_PRESENTE', 'NO_LLEGO', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoModificador" AS ENUM ('EXCLUSION', 'ADICION');

-- CreateTable
CREATE TABLE "tenants" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "direccion" TEXT,
    "logo" TEXT,
    "bannerUrl" TEXT,
    "colorPrimario" TEXT DEFAULT '#3B82F6',
    "colorSecundario" TEXT DEFAULT '#1E40AF',
    "plan" "PlanTenant" NOT NULL DEFAULT 'FREE',
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verificaciones" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'MOZO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empleados" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "telefono" TEXT,
    "direccion" TEXT,
    "rol" "Rol" NOT NULL,
    "tarifaHora" DECIMAL(10,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empleados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fichajes" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "empleadoId" INTEGER NOT NULL,
    "entrada" TIMESTAMP(3) NOT NULL,
    "salida" TIMESTAMP(3),
    "fecha" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fichajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidaciones" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "empleadoId" INTEGER NOT NULL,
    "periodoDesde" DATE NOT NULL,
    "periodoHasta" DATE NOT NULL,
    "horasTotales" DECIMAL(10,2) NOT NULL,
    "tarifaHora" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "descuentos" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "adicionales" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalPagar" DECIMAL(10,2) NOT NULL,
    "observaciones" TEXT,
    "pagado" BOOLEAN NOT NULL DEFAULT false,
    "fechaPago" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liquidaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mesas" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "zona" TEXT,
    "capacidad" INTEGER NOT NULL DEFAULT 4,
    "estado" "EstadoMesa" NOT NULL DEFAULT 'LIBRE',
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mesas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
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

-- CreateTable
CREATE TABLE "categorias" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precio" DECIMAL(10,2) NOT NULL,
    "imagen" TEXT,
    "categoriaId" INTEGER NOT NULL,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "destacado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "productoBaseId" INTEGER,
    "nombreVariante" TEXT,
    "multiplicadorInsumos" DECIMAL(3,1) NOT NULL DEFAULT 1.0,
    "ordenVariante" INTEGER NOT NULL DEFAULT 0,
    "esVariantePredeterminada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modificadores" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
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
    "tenantId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "modificadorId" INTEGER NOT NULL,

    CONSTRAINT "producto_modificadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredientes" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "stockActual" DECIMAL(10,3) NOT NULL,
    "stockMinimo" DECIMAL(10,3) NOT NULL,
    "costo" DECIMAL(10,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto_ingredientes" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "ingredienteId" INTEGER NOT NULL,
    "cantidad" DECIMAL(10,3) NOT NULL,

    CONSTRAINT "producto_ingredientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_stock" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "ingredienteId" INTEGER NOT NULL,
    "tipo" "TipoMovimientoStock" NOT NULL,
    "cantidad" DECIMAL(10,3) NOT NULL,
    "motivo" TEXT,
    "pedidoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "tipo" "TipoPedido" NOT NULL,
    "estado" "EstadoPedido" NOT NULL DEFAULT 'PENDIENTE',
    "mesaId" INTEGER,
    "usuarioId" INTEGER,
    "clienteNombre" TEXT,
    "clienteTelefono" TEXT,
    "clienteDireccion" TEXT,
    "clienteEmail" TEXT,
    "tipoEntrega" "TipoEntrega",
    "costoEnvio" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "descuento" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "observaciones" TEXT,
    "estadoPago" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "origen" "OrigenPedido" NOT NULL DEFAULT 'INTERNO',
    "impreso" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_items" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedido_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_item_modificadores" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "pedidoItemId" INTEGER NOT NULL,
    "modificadorId" INTEGER NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "pedido_item_modificadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "metodo" "MetodoPago" NOT NULL,
    "estado" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "referencia" TEXT,
    "comprobante" TEXT,
    "mpPreferenceId" TEXT,
    "mpPaymentId" TEXT,
    "montoAbonado" DECIMAL(10,2),
    "vuelto" DECIMAL(10,2),
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cierres_caja" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
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

-- CreateTable
CREATE TABLE "print_jobs" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "tipo" "TipoComanda" NOT NULL,
    "status" "EstadoPrintJob" NOT NULL DEFAULT 'PENDIENTE',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "maxIntentos" INTEGER NOT NULL DEFAULT 3,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "contenido" TEXT NOT NULL,
    "anchoMm" INTEGER NOT NULL DEFAULT 80,
    "batchId" TEXT NOT NULL,
    "claimedBy" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuraciones" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuraciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mercadopago_configs" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "publicKey" TEXT,
    "userId" TEXT,
    "email" TEXT,
    "expiresAt" TIMESTAMP(3),
    "isOAuth" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mercadopago_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transacciones_mercadopago" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "pagoId" INTEGER,
    "mpPaymentId" TEXT NOT NULL,
    "mpPreferenceId" TEXT,
    "status" TEXT NOT NULL,
    "statusDetail" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "payerEmail" TEXT,
    "paymentMethod" TEXT,
    "paymentTypeId" TEXT,
    "installments" INTEGER,
    "fee" DECIMAL(10,2),
    "netAmount" DECIMAL(10,2),
    "externalReference" TEXT,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transacciones_mercadopago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "email_verificaciones_token_key" ON "email_verificaciones"("token");

-- CreateIndex
CREATE INDEX "email_verificaciones_tenantId_usuarioId_idx" ON "email_verificaciones"("tenantId", "usuarioId");

-- CreateIndex
CREATE INDEX "email_verificaciones_token_idx" ON "email_verificaciones"("token");

-- CreateIndex
CREATE INDEX "usuarios_tenantId_idx" ON "usuarios"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_tenantId_email_key" ON "usuarios"("tenantId", "email");

-- CreateIndex
CREATE INDEX "empleados_tenantId_idx" ON "empleados"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "empleados_tenantId_dni_key" ON "empleados"("tenantId", "dni");

-- CreateIndex
CREATE INDEX "fichajes_tenantId_idx" ON "fichajes"("tenantId");

-- CreateIndex
CREATE INDEX "fichajes_tenantId_empleadoId_fecha_idx" ON "fichajes"("tenantId", "empleadoId", "fecha");

-- CreateIndex
CREATE INDEX "fichajes_empleadoId_idx" ON "fichajes"("empleadoId");

-- CreateIndex
CREATE INDEX "liquidaciones_tenantId_idx" ON "liquidaciones"("tenantId");

-- CreateIndex
CREATE INDEX "liquidaciones_empleadoId_idx" ON "liquidaciones"("empleadoId");

-- CreateIndex
CREATE INDEX "mesas_tenantId_idx" ON "mesas"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "mesas_tenantId_numero_key" ON "mesas"("tenantId", "numero");

-- CreateIndex
CREATE INDEX "reservas_tenantId_idx" ON "reservas"("tenantId");

-- CreateIndex
CREATE INDEX "reservas_tenantId_fechaHora_idx" ON "reservas"("tenantId", "fechaHora");

-- CreateIndex
CREATE INDEX "reservas_tenantId_mesaId_fechaHora_idx" ON "reservas"("tenantId", "mesaId", "fechaHora");

-- CreateIndex
CREATE INDEX "reservas_mesaId_idx" ON "reservas"("mesaId");

-- CreateIndex
CREATE INDEX "categorias_tenantId_idx" ON "categorias"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_tenantId_nombre_key" ON "categorias"("tenantId", "nombre");

-- CreateIndex
CREATE INDEX "productos_tenantId_idx" ON "productos"("tenantId");

-- CreateIndex
CREATE INDEX "productos_tenantId_categoriaId_idx" ON "productos"("tenantId", "categoriaId");

-- CreateIndex
CREATE INDEX "productos_tenantId_productoBaseId_idx" ON "productos"("tenantId", "productoBaseId");

-- CreateIndex
CREATE INDEX "productos_categoriaId_idx" ON "productos"("categoriaId");

-- CreateIndex
CREATE INDEX "modificadores_tenantId_idx" ON "modificadores"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "modificadores_tenantId_nombre_key" ON "modificadores"("tenantId", "nombre");

-- CreateIndex
CREATE INDEX "producto_modificadores_tenantId_idx" ON "producto_modificadores"("tenantId");

-- CreateIndex
CREATE INDEX "producto_modificadores_productoId_idx" ON "producto_modificadores"("productoId");

-- CreateIndex
CREATE INDEX "producto_modificadores_modificadorId_idx" ON "producto_modificadores"("modificadorId");

-- CreateIndex
CREATE UNIQUE INDEX "producto_modificadores_tenantId_productoId_modificadorId_key" ON "producto_modificadores"("tenantId", "productoId", "modificadorId");

-- CreateIndex
CREATE INDEX "ingredientes_tenantId_idx" ON "ingredientes"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ingredientes_tenantId_nombre_key" ON "ingredientes"("tenantId", "nombre");

-- CreateIndex
CREATE INDEX "producto_ingredientes_tenantId_idx" ON "producto_ingredientes"("tenantId");

-- CreateIndex
CREATE INDEX "producto_ingredientes_productoId_idx" ON "producto_ingredientes"("productoId");

-- CreateIndex
CREATE INDEX "producto_ingredientes_ingredienteId_idx" ON "producto_ingredientes"("ingredienteId");

-- CreateIndex
CREATE UNIQUE INDEX "producto_ingredientes_tenantId_productoId_ingredienteId_key" ON "producto_ingredientes"("tenantId", "productoId", "ingredienteId");

-- CreateIndex
CREATE INDEX "movimientos_stock_tenantId_idx" ON "movimientos_stock"("tenantId");

-- CreateIndex
CREATE INDEX "movimientos_stock_tenantId_ingredienteId_idx" ON "movimientos_stock"("tenantId", "ingredienteId");

-- CreateIndex
CREATE INDEX "movimientos_stock_pedidoId_idx" ON "movimientos_stock"("pedidoId");

-- CreateIndex
CREATE INDEX "pedidos_tenantId_idx" ON "pedidos"("tenantId");

-- CreateIndex
CREATE INDEX "pedidos_tenantId_estado_idx" ON "pedidos"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "pedidos_tenantId_tipo_idx" ON "pedidos"("tenantId", "tipo");

-- CreateIndex
CREATE INDEX "pedidos_tenantId_createdAt_idx" ON "pedidos"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "pedidos_mesaId_idx" ON "pedidos"("mesaId");

-- CreateIndex
CREATE INDEX "pedidos_usuarioId_idx" ON "pedidos"("usuarioId");

-- CreateIndex
CREATE INDEX "pedido_items_tenantId_idx" ON "pedido_items"("tenantId");

-- CreateIndex
CREATE INDEX "pedido_items_tenantId_pedidoId_idx" ON "pedido_items"("tenantId", "pedidoId");

-- CreateIndex
CREATE INDEX "pedido_items_pedidoId_idx" ON "pedido_items"("pedidoId");

-- CreateIndex
CREATE INDEX "pedido_items_productoId_idx" ON "pedido_items"("productoId");

-- CreateIndex
CREATE INDEX "pedido_item_modificadores_tenantId_idx" ON "pedido_item_modificadores"("tenantId");

-- CreateIndex
CREATE INDEX "pedido_item_modificadores_pedidoItemId_idx" ON "pedido_item_modificadores"("pedidoItemId");

-- CreateIndex
CREATE INDEX "pedido_item_modificadores_modificadorId_idx" ON "pedido_item_modificadores"("modificadorId");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_idempotencyKey_key" ON "pagos"("idempotencyKey");

-- CreateIndex
CREATE INDEX "pagos_tenantId_idx" ON "pagos"("tenantId");

-- CreateIndex
CREATE INDEX "pagos_tenantId_pedidoId_idx" ON "pagos"("tenantId", "pedidoId");

-- CreateIndex
CREATE INDEX "pagos_pedidoId_idx" ON "pagos"("pedidoId");

-- CreateIndex
CREATE INDEX "pagos_mpPaymentId_idx" ON "pagos"("mpPaymentId");

-- CreateIndex
CREATE INDEX "cierres_caja_tenantId_idx" ON "cierres_caja"("tenantId");

-- CreateIndex
CREATE INDEX "cierres_caja_tenantId_fecha_idx" ON "cierres_caja"("tenantId", "fecha");

-- CreateIndex
CREATE INDEX "cierres_caja_tenantId_usuarioId_fecha_idx" ON "cierres_caja"("tenantId", "usuarioId", "fecha");

-- CreateIndex
CREATE INDEX "print_jobs_tenantId_idx" ON "print_jobs"("tenantId");

-- CreateIndex
CREATE INDEX "print_jobs_tenantId_status_nextAttemptAt_idx" ON "print_jobs"("tenantId", "status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "print_jobs_tenantId_pedidoId_batchId_idx" ON "print_jobs"("tenantId", "pedidoId", "batchId");

-- CreateIndex
CREATE INDEX "print_jobs_pedidoId_idx" ON "print_jobs"("pedidoId");

-- CreateIndex
CREATE UNIQUE INDEX "print_jobs_tenantId_pedidoId_tipo_batchId_key" ON "print_jobs"("tenantId", "pedidoId", "tipo", "batchId");

-- CreateIndex
CREATE INDEX "configuraciones_tenantId_idx" ON "configuraciones"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "configuraciones_tenantId_clave_key" ON "configuraciones"("tenantId", "clave");

-- CreateIndex
CREATE UNIQUE INDEX "mercadopago_configs_tenantId_key" ON "mercadopago_configs"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "transacciones_mercadopago_mpPaymentId_key" ON "transacciones_mercadopago"("mpPaymentId");

-- CreateIndex
CREATE INDEX "transacciones_mercadopago_tenantId_idx" ON "transacciones_mercadopago"("tenantId");

-- CreateIndex
CREATE INDEX "transacciones_mercadopago_tenantId_createdAt_idx" ON "transacciones_mercadopago"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "transacciones_mercadopago_tenantId_status_idx" ON "transacciones_mercadopago"("tenantId", "status");

-- CreateIndex
CREATE INDEX "transacciones_mercadopago_pagoId_idx" ON "transacciones_mercadopago"("pagoId");

-- AddForeignKey
ALTER TABLE "email_verificaciones" ADD CONSTRAINT "email_verificaciones_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verificaciones" ADD CONSTRAINT "email_verificaciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichajes" ADD CONSTRAINT "fichajes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichajes" ADD CONSTRAINT "fichajes_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidaciones" ADD CONSTRAINT "liquidaciones_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidaciones" ADD CONSTRAINT "liquidaciones_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesas" ADD CONSTRAINT "mesas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "mesas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_productoBaseId_fkey" FOREIGN KEY ("productoBaseId") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modificadores" ADD CONSTRAINT "modificadores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_modificadores" ADD CONSTRAINT "producto_modificadores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_modificadores" ADD CONSTRAINT "producto_modificadores_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_modificadores" ADD CONSTRAINT "producto_modificadores_modificadorId_fkey" FOREIGN KEY ("modificadorId") REFERENCES "modificadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredientes" ADD CONSTRAINT "ingredientes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_ingredientes" ADD CONSTRAINT "producto_ingredientes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_ingredientes" ADD CONSTRAINT "producto_ingredientes_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_ingredientes" ADD CONSTRAINT "producto_ingredientes_ingredienteId_fkey" FOREIGN KEY ("ingredienteId") REFERENCES "ingredientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_ingredienteId_fkey" FOREIGN KEY ("ingredienteId") REFERENCES "ingredientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "mesas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_item_modificadores" ADD CONSTRAINT "pedido_item_modificadores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_item_modificadores" ADD CONSTRAINT "pedido_item_modificadores_pedidoItemId_fkey" FOREIGN KEY ("pedidoItemId") REFERENCES "pedido_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_item_modificadores" ADD CONSTRAINT "pedido_item_modificadores_modificadorId_fkey" FOREIGN KEY ("modificadorId") REFERENCES "modificadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierres_caja" ADD CONSTRAINT "cierres_caja_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierres_caja" ADD CONSTRAINT "cierres_caja_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuraciones" ADD CONSTRAINT "configuraciones_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mercadopago_configs" ADD CONSTRAINT "mercadopago_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacciones_mercadopago" ADD CONSTRAINT "transacciones_mercadopago_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacciones_mercadopago" ADD CONSTRAINT "transacciones_mercadopago_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "pagos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
