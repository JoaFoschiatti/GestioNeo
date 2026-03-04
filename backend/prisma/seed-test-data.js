require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🧪 Inyectando datos de prueba...\n')

  const tenantSlug = process.env.SEED_TENANT_SLUG || 'ewald'
  const tenantNombre = process.env.SEED_TENANT_NOMBRE || 'Estación Ewald'
  const tenantEmail = process.env.SEED_TENANT_EMAIL || 'admin@ewald.com'

  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: { nombre: tenantNombre, email: tenantEmail, activo: true },
    create: { slug: tenantSlug, nombre: tenantNombre, email: tenantEmail, activo: true }
  })

  const tenantId = tenant.id

  // ============================================
  // 1. USUARIOS DEL SISTEMA
  // ============================================
  console.log('👤 Creando usuarios...')

  const passwordHash = await bcrypt.hash('123456', 10)

  const usuarios = await Promise.all([
    prisma.usuario.upsert({
      where: { tenantId_email: { tenantId, email: 'admin@ewald.com' } },
      update: {},
      create: { tenantId, email: 'admin@ewald.com', password: passwordHash, nombre: 'Administrador', rol: 'ADMIN' }
    }),
    prisma.usuario.upsert({
      where: { tenantId_email: { tenantId, email: 'mozo1@ewald.com' } },
      update: {},
      create: { tenantId, email: 'mozo1@ewald.com', password: passwordHash, nombre: 'Juan Pérez', rol: 'MOZO' }
    }),
    prisma.usuario.upsert({
      where: { tenantId_email: { tenantId, email: 'mozo2@ewald.com' } },
      update: {},
      create: { tenantId, email: 'mozo2@ewald.com', password: passwordHash, nombre: 'María García', rol: 'MOZO' }
    }),
    prisma.usuario.upsert({
      where: { tenantId_email: { tenantId, email: 'cocina@ewald.com' } },
      update: {},
      create: { tenantId, email: 'cocina@ewald.com', password: passwordHash, nombre: 'Carlos Rodríguez', rol: 'COCINERO' }
    }),
    prisma.usuario.upsert({
      where: { tenantId_email: { tenantId, email: 'caja@ewald.com' } },
      update: {},
      create: { tenantId, email: 'caja@ewald.com', password: passwordHash, nombre: 'Laura Martínez', rol: 'CAJERO' }
    }),
    prisma.usuario.upsert({
      where: { tenantId_email: { tenantId, email: 'delivery@ewald.com' } },
      update: {},
      create: { tenantId, email: 'delivery@ewald.com', password: passwordHash, nombre: 'Pedro López', rol: 'DELIVERY' }
    }),
  ])

  const [_admin, mozo1, mozo2, _cocinero, _cajero, _delivery] = usuarios

  // ============================================
  // 2. EMPLEADOS (para fichaje y liquidación)
  // ============================================
  console.log('👷 Creando empleados...')

  const empleados = await Promise.all([
    prisma.empleado.upsert({
      where: { tenantId_dni: { tenantId, dni: '30111222' } },
      update: {},
      create: { tenantId, nombre: 'Juan', apellido: 'Pérez', dni: '30111222', telefono: '3411234567', rol: 'MOZO', tarifaHora: 1500 }
    }),
    prisma.empleado.upsert({
      where: { tenantId_dni: { tenantId, dni: '30222333' } },
      update: {},
      create: { tenantId, nombre: 'María', apellido: 'García', dni: '30222333', telefono: '3412345678', rol: 'MOZO', tarifaHora: 1500 }
    }),
    prisma.empleado.upsert({
      where: { tenantId_dni: { tenantId, dni: '30333444' } },
      update: {},
      create: { tenantId, nombre: 'Carlos', apellido: 'Rodríguez', dni: '30333444', telefono: '3413456789', rol: 'COCINERO', tarifaHora: 1800 }
    }),
    prisma.empleado.upsert({
      where: { tenantId_dni: { tenantId, dni: '30444555' } },
      update: {},
      create: { tenantId, nombre: 'Laura', apellido: 'Martínez', dni: '30444555', telefono: '3414567890', rol: 'CAJERO', tarifaHora: 1600 }
    }),
    prisma.empleado.upsert({
      where: { tenantId_dni: { tenantId, dni: '30555666' } },
      update: {},
      create: { tenantId, nombre: 'Pedro', apellido: 'López', dni: '30555666', telefono: '3415678901', rol: 'DELIVERY', tarifaHora: 1400 }
    }),
  ])

  // ============================================
  // 3. FICHAJES (últimos 7 días)
  // ============================================
  console.log('🕐 Creando fichajes...')

  const hoy = new Date()
  const fichajes = []

  for (let i = 0; i < 7; i++) {
    const fecha = new Date(hoy)
    fecha.setDate(fecha.getDate() - i)
    fecha.setHours(0, 0, 0, 0)

    // Fichajes para cada empleado (excepto fin de semana)
    if (fecha.getDay() !== 0 && fecha.getDay() !== 6) {
      for (const emp of empleados) {
        const entrada = new Date(fecha)
        entrada.setHours(11 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 30), 0, 0)

        const salida = new Date(fecha)
        salida.setHours(20 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 60), 0, 0)

        // Hoy algunos no tienen salida aún
        const tieneSalida = i > 0 || Math.random() > 0.5

        fichajes.push({
          tenantId,
          empleadoId: emp.id,
          entrada,
          salida: tieneSalida ? salida : null,
          fecha,
        })
      }
    }
  }

  await prisma.fichaje.createMany({ data: fichajes, skipDuplicates: true })

  // ============================================
  // 4. LIQUIDACIONES
  // ============================================
  console.log('💵 Creando liquidaciones...')

  const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
  const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0)

  await prisma.liquidacion.createMany({
    data: [
      {
        tenantId,
        empleadoId: empleados[0].id,
        periodoDesde: inicioMesAnterior,
        periodoHasta: finMesAnterior,
        horasTotales: 160,
        tarifaHora: 1500,
        subtotal: 240000,
        descuentos: 0,
        adicionales: 15000,
        totalPagar: 255000,
        pagado: true,
        fechaPago: new Date(hoy.getFullYear(), hoy.getMonth(), 5),
      },
      {
        tenantId,
        empleadoId: empleados[1].id,
        periodoDesde: inicioMesAnterior,
        periodoHasta: finMesAnterior,
        horasTotales: 140,
        tarifaHora: 1500,
        subtotal: 210000,
        descuentos: 5000,
        adicionales: 0,
        totalPagar: 205000,
        pagado: false,
        observaciones: 'Pendiente de pago',
      },
    ],
    skipDuplicates: true,
  })

  // ============================================
  // 5. MESAS
  // ============================================
  console.log('🪑 Creando mesas...')

  const mesas = await Promise.all([
    prisma.mesa.upsert({ where: { tenantId_numero: { tenantId, numero: 1 } }, update: {}, create: { tenantId, numero: 1, zona: 'Interior', capacidad: 4, estado: 'OCUPADA' } }),
    prisma.mesa.upsert({ where: { tenantId_numero: { tenantId, numero: 2 } }, update: {}, create: { tenantId, numero: 2, zona: 'Interior', capacidad: 4, estado: 'LIBRE' } }),
    prisma.mesa.upsert({ where: { tenantId_numero: { tenantId, numero: 3 } }, update: {}, create: { tenantId, numero: 3, zona: 'Interior', capacidad: 6, estado: 'LIBRE' } }),
    prisma.mesa.upsert({ where: { tenantId_numero: { tenantId, numero: 4 } }, update: {}, create: { tenantId, numero: 4, zona: 'Interior', capacidad: 2, estado: 'RESERVADA' } }),
    prisma.mesa.upsert({ where: { tenantId_numero: { tenantId, numero: 5 } }, update: {}, create: { tenantId, numero: 5, zona: 'Terraza', capacidad: 4, estado: 'OCUPADA' } }),
    prisma.mesa.upsert({ where: { tenantId_numero: { tenantId, numero: 6 } }, update: {}, create: { tenantId, numero: 6, zona: 'Terraza', capacidad: 4, estado: 'LIBRE' } }),
    prisma.mesa.upsert({ where: { tenantId_numero: { tenantId, numero: 7 } }, update: {}, create: { tenantId, numero: 7, zona: 'Terraza', capacidad: 8, estado: 'LIBRE' } }),
    prisma.mesa.upsert({ where: { tenantId_numero: { tenantId, numero: 8 } }, update: {}, create: { tenantId, numero: 8, zona: 'Barra', capacidad: 2, estado: 'LIBRE' } }),
  ])

  // ============================================
  // 6. INGREDIENTES (Stock)
  // ============================================
  console.log('📦 Creando ingredientes...')

  const ingredientes = await Promise.all([
    prisma.ingrediente.upsert({
      where: { tenantId_nombre: { tenantId, nombre: 'Carne molida' } },
      update: {},
      create: { tenantId, nombre: 'Carne molida', unidad: 'kg', stockActual: 25, stockMinimo: 10, costo: 3500 }
    }),
    prisma.ingrediente.upsert({
      where: { tenantId_nombre: { tenantId, nombre: 'Pan de hamburguesa' } },
      update: {},
      create: { tenantId, nombre: 'Pan de hamburguesa', unidad: 'unidades', stockActual: 150, stockMinimo: 50, costo: 200 }
    }),
    prisma.ingrediente.upsert({
      where: { tenantId_nombre: { tenantId, nombre: 'Queso cheddar' } },
      update: {},
      create: { tenantId, nombre: 'Queso cheddar', unidad: 'kg', stockActual: 8, stockMinimo: 3, costo: 4500 }
    }),
    prisma.ingrediente.upsert({
      where: { tenantId_nombre: { tenantId, nombre: 'Queso azul' } },
      update: {},
      create: { tenantId, nombre: 'Queso azul', unidad: 'kg', stockActual: 3, stockMinimo: 1, costo: 6000 }
    }),
    prisma.ingrediente.upsert({
      where: { tenantId_nombre: { tenantId, nombre: 'Muzzarella' } },
      update: {},
      create: { tenantId, nombre: 'Muzzarella', unidad: 'kg', stockActual: 12, stockMinimo: 5, costo: 4000 }
    }),
    prisma.ingrediente.upsert({
      where: { tenantId_nombre: { tenantId, nombre: 'Panceta ahumada' } },
      update: {},
      create: { tenantId, nombre: 'Panceta ahumada', unidad: 'kg', stockActual: 6, stockMinimo: 2, costo: 5500 }
    }),
    prisma.ingrediente.upsert({
      where: { tenantId_nombre: { tenantId, nombre: 'Lechuga' } },
      update: {},
      create: { tenantId, nombre: 'Lechuga', unidad: 'unidades', stockActual: 30, stockMinimo: 10, costo: 300 }
    }),
    prisma.ingrediente.upsert({
      where: { tenantId_nombre: { tenantId, nombre: 'Tomate' } },
      update: {},
      create: { tenantId, nombre: 'Tomate', unidad: 'kg', stockActual: 10, stockMinimo: 5, costo: 800 }
    }),
    prisma.ingrediente.upsert({
      where: { tenantId_nombre: { tenantId, nombre: 'Cebolla' } },
      update: {},
      create: { tenantId, nombre: 'Cebolla', unidad: 'kg', stockActual: 15, stockMinimo: 5, costo: 400 }
    }),
    prisma.ingrediente.upsert({
      where: { tenantId_nombre: { tenantId, nombre: 'Huevo' } },
      update: {},
      create: { tenantId, nombre: 'Huevo', unidad: 'unidades', stockActual: 180, stockMinimo: 60, costo: 100 }
    }),
    prisma.ingrediente.upsert({
      where: { tenantId_nombre: { tenantId, nombre: 'Papas congeladas' } },
      update: {},
      create: { tenantId, nombre: 'Papas congeladas', unidad: 'kg', stockActual: 20, stockMinimo: 8, costo: 1200 }
    }),
    prisma.ingrediente.upsert({
      where: { tenantId_nombre: { tenantId, nombre: 'Salsa BBQ' } },
      update: {},
      create: { tenantId, nombre: 'Salsa BBQ', unidad: 'litros', stockActual: 5, stockMinimo: 2, costo: 1500 }
    }),
    prisma.ingrediente.upsert({
      where: { tenantId_nombre: { tenantId, nombre: 'Mayonesa' } },
      update: {},
      create: { tenantId, nombre: 'Mayonesa', unidad: 'litros', stockActual: 8, stockMinimo: 3, costo: 1200 }
    }),
    prisma.ingrediente.upsert({
      where: { tenantId_nombre: { tenantId, nombre: 'Champiñones' } },
      update: {},
      create: { tenantId, nombre: 'Champiñones', unidad: 'kg', stockActual: 4, stockMinimo: 2, costo: 2500 }
    }),
    prisma.ingrediente.upsert({
      where: { tenantId_nombre: { tenantId, nombre: 'Rúcula' } },
      update: {},
      create: { tenantId, nombre: 'Rúcula', unidad: 'kg', stockActual: 2, stockMinimo: 1, costo: 1800 }
    }),
    prisma.ingrediente.upsert({
      where: { tenantId_nombre: { tenantId, nombre: 'Aceite' } },
      update: {},
      create: { tenantId, nombre: 'Aceite', unidad: 'litros', stockActual: 15, stockMinimo: 5, costo: 900 }
    }),
    prisma.ingrediente.upsert({
      where: { tenantId_nombre: { tenantId, nombre: 'Masa pizza' } },
      update: {},
      create: { tenantId, nombre: 'Masa pizza', unidad: 'unidades', stockActual: 40, stockMinimo: 15, costo: 500 }
    }),
    prisma.ingrediente.upsert({
      where: { tenantId_nombre: { tenantId, nombre: 'Pollo' } },
      update: {},
      create: { tenantId, nombre: 'Pollo', unidad: 'kg', stockActual: 10, stockMinimo: 4, costo: 2800 }
    }),
  ])

  // ============================================
  // 7. PRODUCTO-INGREDIENTES (algunos productos)
  // ============================================
  console.log('🔗 Vinculando productos con ingredientes...')

  // Obtener algunos productos para vincular
  const productos = await prisma.producto.findMany({ where: { tenantId }, take: 10 })

  if (productos.length > 0) {
    const carne = ingredientes.find(i => i.nombre === 'Carne molida')
    const pan = ingredientes.find(i => i.nombre === 'Pan de hamburguesa')
    const cheddar = ingredientes.find(i => i.nombre === 'Queso cheddar')
    // Vincular primer producto (hamburguesa) con ingredientes
    if (productos[0] && carne && pan && cheddar) {
      await prisma.productoIngrediente.createMany({
        data: [
          { tenantId, productoId: productos[0].id, ingredienteId: carne.id, cantidad: 0.1 },
          { tenantId, productoId: productos[0].id, ingredienteId: pan.id, cantidad: 1 },
          { tenantId, productoId: productos[0].id, ingredienteId: cheddar.id, cantidad: 0.03 },
        ],
        skipDuplicates: true,
      })
    }
  }

  // ============================================
  // 8. MOVIMIENTOS DE STOCK
  // ============================================
  console.log('📊 Creando movimientos de stock...')

  const movimientos = []
  for (const ing of ingredientes.slice(0, 8)) {
    // Entrada inicial (hace 7 días)
    movimientos.push({
      tenantId,
      ingredienteId: ing.id,
      tipo: 'ENTRADA',
      cantidad: 50,
      motivo: 'Compra inicial',
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    })

    // Algunas salidas por uso
    movimientos.push({
      tenantId,
      ingredienteId: ing.id,
      tipo: 'SALIDA',
      cantidad: Math.random() * 10 + 5,
      motivo: 'Consumo diario',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    })

    // Un ajuste de inventario
    if (Math.random() > 0.5) {
      movimientos.push({
        tenantId,
        ingredienteId: ing.id,
        tipo: 'AJUSTE',
        cantidad: Math.random() > 0.5 ? 2 : -2,
        motivo: 'Ajuste por inventario físico',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      })
    }
  }

  await prisma.movimientoStock.createMany({ data: movimientos, skipDuplicates: true })

  // ============================================
  // 9. PEDIDOS (varios estados y tipos)
  // ============================================
  console.log('📝 Creando pedidos...')

  // Obtener productos para los pedidos
  const productosParaPedidos = await prisma.producto.findMany({ where: { tenantId } })

  // Pedido 1: Mesa 1 - EN_PREPARACION (interno)
  await prisma.pedido.create({
    data: {
      tenantId,
      tipo: 'MESA',
      estado: 'EN_PREPARACION',
      mesaId: mesas[0].id,
      usuarioId: mozo1.id,
      subtotal: 21400,
      total: 21400,
      origen: 'INTERNO',
      estadoPago: 'PENDIENTE',
      items: {
        create: [
          { tenantId, productoId: productosParaPedidos[0].id, cantidad: 2, precioUnitario: productosParaPedidos[0].precio, subtotal: Number(productosParaPedidos[0].precio) * 2 },
        ]
      }
    }
  })

  // Pedido 2: Mesa 5 - LISTO (interno)
  await prisma.pedido.create({
    data: {
      tenantId,
      tipo: 'MESA',
      estado: 'LISTO',
      mesaId: mesas[4].id,
      usuarioId: mozo2.id,
      subtotal: 32600,
      total: 32600,
      origen: 'INTERNO',
      estadoPago: 'PENDIENTE',
      items: {
        create: [
          { tenantId, productoId: productosParaPedidos[3].id, cantidad: 2, precioUnitario: productosParaPedidos[3].precio, subtotal: Number(productosParaPedidos[3].precio) * 2 },
          { tenantId, productoId: productosParaPedidos[35].id, cantidad: 2, precioUnitario: productosParaPedidos[35].precio, subtotal: Number(productosParaPedidos[35].precio) * 2 },
        ]
      }
    }
  })

  // Pedido 3: DELIVERY - PENDIENTE (menú público)
  await prisma.pedido.create({
    data: {
      tenantId,
      tipo: 'DELIVERY',
      estado: 'PENDIENTE',
      clienteNombre: 'Roberto Fernández',
      clienteTelefono: '3416789012',
      clienteDireccion: 'Av. Pellegrini 1234, Piso 3',
      clienteEmail: 'roberto@email.com',
      tipoEntrega: 'DELIVERY',
      costoEnvio: 1500,
      subtotal: 23200,
      total: 24700,
      origen: 'MENU_PUBLICO',
      estadoPago: 'PENDIENTE',
      items: {
        create: [
          { tenantId, productoId: productosParaPedidos[6].id, cantidad: 2, precioUnitario: productosParaPedidos[6].precio, subtotal: Number(productosParaPedidos[6].precio) * 2 },
        ]
      }
    }
  })

  // Pedido 4: MOSTRADOR - ENTREGADO y COBRADO (efectivo)
  await prisma.pedido.create({
    data: {
      tenantId,
      tipo: 'MOSTRADOR',
      estado: 'COBRADO',
      clienteNombre: 'Ana López',
      subtotal: 16000,
      total: 16000,
      origen: 'INTERNO',
      estadoPago: 'APROBADO',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // Hace 2 horas
      items: {
        create: [
          { tenantId, productoId: productosParaPedidos[8].id, cantidad: 1, precioUnitario: productosParaPedidos[8].precio, subtotal: Number(productosParaPedidos[8].precio) },
        ]
      },
      pagos: {
        create: {
          tenantId,
          monto: 16000,
          metodo: 'EFECTIVO',
          estado: 'APROBADO',
          montoAbonado: 20000,
          vuelto: 4000,
        }
      }
    }
  })

  // Pedido 5: DELIVERY - ENTREGADO (MercadoPago)
  await prisma.pedido.create({
    data: {
      tenantId,
      tipo: 'DELIVERY',
      estado: 'ENTREGADO',
      clienteNombre: 'Martín Gómez',
      clienteTelefono: '3417890123',
      clienteDireccion: 'San Martín 567',
      clienteEmail: 'martin@email.com',
      tipoEntrega: 'DELIVERY',
      costoEnvio: 1500,
      subtotal: 27800,
      total: 29300,
      origen: 'MENU_PUBLICO',
      estadoPago: 'APROBADO',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Ayer
      items: {
        create: [
          { tenantId, productoId: productosParaPedidos[7].id, cantidad: 2, precioUnitario: productosParaPedidos[7].precio, subtotal: Number(productosParaPedidos[7].precio) * 2 },
        ]
      },
      pagos: {
        create: {
          tenantId,
          monto: 29300,
          metodo: 'MERCADOPAGO',
          estado: 'APROBADO',
          mpPreferenceId: 'TEST-pref-123456',
          mpPaymentId: 'TEST-pay-789012',
          referencia: 'MP-12345678',
        }
      }
    }
  })

  // Pedido 6: RETIRO - EN_PREPARACION (menú público)
  await prisma.pedido.create({
    data: {
      tenantId,
      tipo: 'MOSTRADOR',
      estado: 'EN_PREPARACION',
      clienteNombre: 'Lucía Ramírez',
      clienteTelefono: '3418901234',
      clienteEmail: 'lucia@email.com',
      tipoEntrega: 'RETIRO',
      costoEnvio: 0,
      subtotal: 19400,
      total: 19400,
      origen: 'MENU_PUBLICO',
      estadoPago: 'APROBADO',
      items: {
        create: [
          { tenantId, productoId: productosParaPedidos[12].id, cantidad: 1, precioUnitario: productosParaPedidos[12].precio, subtotal: Number(productosParaPedidos[12].precio) },
          { tenantId, productoId: productosParaPedidos[21].id, cantidad: 1, precioUnitario: productosParaPedidos[21].precio, subtotal: Number(productosParaPedidos[21].precio) },
        ]
      },
      pagos: {
        create: {
          tenantId,
          monto: 19400,
          metodo: 'MERCADOPAGO',
          estado: 'APROBADO',
          mpPreferenceId: 'TEST-pref-234567',
          mpPaymentId: 'TEST-pay-890123',
        }
      }
    }
  })

  // Pedido 7: CANCELADO
  await prisma.pedido.create({
    data: {
      tenantId,
      tipo: 'DELIVERY',
      estado: 'CANCELADO',
      clienteNombre: 'Pablo Sánchez',
      clienteTelefono: '3419012345',
      clienteDireccion: 'Córdoba 890',
      tipoEntrega: 'DELIVERY',
      costoEnvio: 1500,
      subtotal: 11600,
      total: 13100,
      origen: 'MENU_PUBLICO',
      estadoPago: 'CANCELADO',
      observaciones: 'Cliente canceló el pedido',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // Hace 3 días
      items: {
        create: [
          { tenantId, productoId: productosParaPedidos[4].id, cantidad: 1, precioUnitario: productosParaPedidos[4].precio, subtotal: Number(productosParaPedidos[4].precio) },
        ]
      }
    }
  })

  // Pedidos históricos cobrados (últimos días)
  for (let i = 1; i <= 5; i++) {
    const fechaPedido = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const prodRandom = productosParaPedidos[Math.floor(Math.random() * productosParaPedidos.length)]
    const cantidad = Math.floor(Math.random() * 3) + 1
    const subtotal = Number(prodRandom.precio) * cantidad

    await prisma.pedido.create({
      data: {
        tenantId,
        tipo: Math.random() > 0.5 ? 'MESA' : 'MOSTRADOR',
        estado: 'COBRADO',
        mesaId: Math.random() > 0.5 ? mesas[Math.floor(Math.random() * mesas.length)].id : null,
        usuarioId: Math.random() > 0.5 ? mozo1.id : mozo2.id,
        clienteNombre: `Cliente ${i}`,
        subtotal: subtotal,
        total: subtotal,
        origen: 'INTERNO',
        estadoPago: 'APROBADO',
        createdAt: fechaPedido,
        items: {
          create: [
            { tenantId, productoId: prodRandom.id, cantidad, precioUnitario: prodRandom.precio, subtotal }
          ]
        },
        pagos: {
          create: {
            tenantId,
            monto: subtotal,
            metodo: Math.random() > 0.5 ? 'EFECTIVO' : 'TARJETA',
            estado: 'APROBADO',
            montoAbonado: Math.random() > 0.5 ? subtotal + 5000 : null,
            vuelto: Math.random() > 0.5 ? 5000 : null,
          }
        }
      }
    })
  }

  // ============================================
  // 10. CONFIGURACIÓN DEL SISTEMA
  // ============================================
  console.log('⚙️  Creando configuración...')

  const configuraciones = [
    { clave: 'tienda_abierta', valor: 'true' },
    { clave: 'horario_apertura', valor: '11:00' },
    { clave: 'horario_cierre', valor: '23:30' },
    { clave: 'nombre_negocio', valor: 'Estación Ewald' },
    { clave: 'tagline_negocio', valor: 'Hamburguesas artesanales & Cerveza' },
    { clave: 'banner_imagen', valor: '' },
    { clave: 'costo_delivery', valor: '1500' },
    { clave: 'delivery_habilitado', valor: 'true' },
    { clave: 'direccion_retiro', valor: 'Av. Principal 1234, Avellaneda, Santa Fe' },
    { clave: 'whatsapp_numero', valor: '5493415551234' },
    { clave: 'mercadopago_enabled', valor: 'true' },
    { clave: 'efectivo_enabled', valor: 'true' },
  ]

  for (const config of configuraciones) {
    await prisma.configuracion.upsert({
      where: { tenantId_clave: { tenantId, clave: config.clave } },
      update: { valor: config.valor },
      create: { tenantId, ...config },
    })
  }

  // ============================================
  // RESUMEN FINAL
  // ============================================
  console.log('\n✅ Datos de prueba inyectados exitosamente!\n')

  const resumen = {
    usuarios: await prisma.usuario.count({ where: { tenantId } }),
    empleados: await prisma.empleado.count({ where: { tenantId } }),
    fichajes: await prisma.fichaje.count({ where: { tenantId } }),
    liquidaciones: await prisma.liquidacion.count({ where: { tenantId } }),
    mesas: await prisma.mesa.count({ where: { tenantId } }),
    categorias: await prisma.categoria.count({ where: { tenantId } }),
    productos: await prisma.producto.count({ where: { tenantId } }),
    ingredientes: await prisma.ingrediente.count({ where: { tenantId } }),
    movimientosStock: await prisma.movimientoStock.count({ where: { tenantId } }),
    pedidos: await prisma.pedido.count({ where: { tenantId } }),
    pedidoItems: await prisma.pedidoItem.count({ where: { tenantId } }),
    pagos: await prisma.pago.count({ where: { tenantId } }),
    configuraciones: await prisma.configuracion.count({ where: { tenantId } }),
  }

  console.log('📊 Resumen de datos:')
  console.log('   👤 Usuarios:', resumen.usuarios)
  console.log('   👷 Empleados:', resumen.empleados)
  console.log('   🕐 Fichajes:', resumen.fichajes)
  console.log('   💵 Liquidaciones:', resumen.liquidaciones)
  console.log('   🪑 Mesas:', resumen.mesas)
  console.log('   📁 Categorías:', resumen.categorias)
  console.log('   🍔 Productos:', resumen.productos)
  console.log('   📦 Ingredientes:', resumen.ingredientes)
  console.log('   📊 Movimientos stock:', resumen.movimientosStock)
  console.log('   📝 Pedidos:', resumen.pedidos)
  console.log('   🛒 Items de pedido:', resumen.pedidoItems)
  console.log('   💳 Pagos:', resumen.pagos)
  console.log('   ⚙️  Configuraciones:', resumen.configuraciones)

  console.log('\n🔐 Credenciales de prueba:')
  console.log('   Email: admin@ewald.com | Password: 123456 (ADMIN)')
  console.log('   Email: mozo1@ewald.com | Password: 123456 (MOZO)')
  console.log('   Email: cocina@ewald.com | Password: 123456 (COCINERO)')
  console.log('   Email: caja@ewald.com | Password: 123456 (CAJERO)')
  console.log('   Email: delivery@ewald.com | Password: 123456 (DELIVERY)')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
