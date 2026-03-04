require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')

const prisma = new PrismaClient()

// ============================================
// HELPERS
// ============================================

const now = new Date()

function daysAgo(days) {
  const d = new Date(now)
  d.setDate(d.getDate() - days)
  return d
}

function daysFromNow(days) {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  return d
}

function randomDate(daysAgoMax, daysAgoMin = 0) {
  const d = new Date(now)
  const range = daysAgoMax - daysAgoMin
  d.setDate(d.getDate() - daysAgoMin - Math.floor(Math.random() * range))
  d.setHours(11 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), 0, 0)
  return d
}

function dateOnly(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('=== SEED MASIVO - Datos de prueba ===\n')

  // --------------------------------
  // FASE 0: Limpiar DB
  // --------------------------------
  console.log('Limpiando base de datos...')
  await prisma.transaccionMercadoPago.deleteMany()
  await prisma.pedidoItemModificador.deleteMany()
  await prisma.pedidoItem.deleteMany()
  await prisma.printJob.deleteMany()
  await prisma.pago.deleteMany()
  await prisma.transferenciaEntrante.deleteMany()
  await prisma.movimientoStock.deleteMany()
  await prisma.pedido.deleteMany()
  await prisma.productoModificador.deleteMany()
  await prisma.productoIngrediente.deleteMany()
  await prisma.modificador.deleteMany()
  await prisma.producto.deleteMany()
  await prisma.categoria.deleteMany()
  await prisma.ingrediente.deleteMany()
  await prisma.reserva.deleteMany()
  await prisma.mesa.deleteMany()
  await prisma.fichaje.deleteMany()
  await prisma.liquidacion.deleteMany()
  await prisma.cierreCaja.deleteMany()
  await prisma.configuracion.deleteMany()
  await prisma.refreshToken.deleteMany()
  await prisma.emailVerificacion.deleteMany()
  await prisma.usuario.deleteMany()
  await prisma.empleado.deleteMany()
  await prisma.pagoSuscripcion.deleteMany()
  await prisma.suscripcion.deleteMany()
  await prisma.syncTransferencias.deleteMany()
  await prisma.mercadoPagoConfig.deleteMany()
  await prisma.negocio.deleteMany()
  console.log('  OK\n')

  // --------------------------------
  // FASE 1: Negocio + Suscripcion + Config
  // --------------------------------
  console.log('Creando negocio y suscripcion...')
  await prisma.negocio.create({
    data: {
      id: 1,
      nombre: 'La Parrilla de Don Carlos',
      email: 'contacto@laparrilla.com.ar',
      telefono: '11-4555-8900',
      direccion: 'Av. Corrientes 3456, CABA, Buenos Aires',
      colorPrimario: '#DC2626',
      colorSecundario: '#991B1B'
    }
  })

  await prisma.suscripcion.create({
    data: {
      id: 1,
      estado: 'ACTIVA',
      fechaInicio: daysAgo(30),
      fechaVencimiento: daysFromNow(30),
      precioMensual: 37000
    }
  })

  const configs = [
    { clave: 'nombre_local', valor: 'La Parrilla de Don Carlos' },
    { clave: 'direccion', valor: 'Av. Corrientes 3456, CABA' },
    { clave: 'telefono', valor: '11-4555-8900' },
    { clave: 'moneda', valor: 'ARS' },
    { clave: 'horario_apertura', valor: '11:30' },
    { clave: 'horario_cierre', valor: '00:30' },
    { clave: 'costo_delivery', valor: '1500' },
    { clave: 'delivery_habilitado', valor: 'true' },
    { clave: 'whatsapp_numero', valor: '5491145558900' }
  ]
  await prisma.configuracion.createMany({ data: configs })
  console.log('  OK\n')

  // --------------------------------
  // FASE 2: Usuarios (7)
  // --------------------------------
  console.log('Creando 7 usuarios...')
  const passwordHash = await bcrypt.hash('test123', 10)

  const usuariosData = [
    { email: 'admin@comanda.app', nombre: 'Carlos Admin', rol: 'ADMIN' },
    { email: 'mozo@comanda.app', nombre: 'Juan Perez', rol: 'MOZO' },
    { email: 'mozo2@comanda.app', nombre: 'Maria Gonzalez', rol: 'MOZO' },
    { email: 'cocinero@comanda.app', nombre: 'Pedro Lopez', rol: 'COCINERO' },
    { email: 'cocinero2@comanda.app', nombre: 'Lucas Fernandez', rol: 'COCINERO' },
    { email: 'cajero@comanda.app', nombre: 'Ana Martinez', rol: 'CAJERO' },
    { email: 'delivery@comanda.app', nombre: 'Diego Rodriguez', rol: 'DELIVERY' }
  ]

  for (const u of usuariosData) {
    await prisma.usuario.create({ data: { ...u, password: passwordHash } })
  }

  const usuarios = {}
  const allUsers = await prisma.usuario.findMany()
  for (const u of allUsers) {
    usuarios[u.rol] = usuarios[u.rol] || []
    usuarios[u.rol].push(u)
  }
  const admin = usuarios.ADMIN[0]
  const mozos = usuarios.MOZO
  const cajero = usuarios.CAJERO[0]
  console.log('  OK\n')

  // --------------------------------
  // FASE 3: Empleados (8)
  // --------------------------------
  console.log('Creando 8 empleados...')
  const empleadosData = [
    { nombre: 'Juan', apellido: 'Perez', dni: '30123456', telefono: '1155551001', direccion: 'Av. Santa Fe 1234', rol: 'MOZO', tarifaHora: 2500 },
    { nombre: 'Maria', apellido: 'Gonzalez', dni: '31234567', telefono: '1155552002', direccion: 'Av. Rivadavia 567', rol: 'MOZO', tarifaHora: 2500 },
    { nombre: 'Pedro', apellido: 'Lopez', dni: '32345678', telefono: '1155553003', direccion: 'Calle Florida 890', rol: 'COCINERO', tarifaHora: 3000 },
    { nombre: 'Ana', apellido: 'Martinez', dni: '33456789', telefono: '1155554004', direccion: 'Av. Callao 234', rol: 'CAJERO', tarifaHora: 2800 },
    { nombre: 'Lucas', apellido: 'Fernandez', dni: '34567890', telefono: '1155555005', direccion: 'Av. Belgrano 678', rol: 'COCINERO', tarifaHora: 3000 },
    { nombre: 'Carlos', apellido: 'Rodriguez', dni: '35678901', telefono: '1155556006', direccion: 'Calle Tucuman 345', rol: 'DELIVERY', tarifaHora: 2200 },
    { nombre: 'Sofia', apellido: 'Ramirez', dni: '36789012', telefono: '1155557007', direccion: 'Av. Pueyrredon 123', rol: 'MOZO', tarifaHora: 2500 },
    { nombre: 'Diego', apellido: 'Alvarez', dni: '37890123', telefono: '1155558008', direccion: 'Calle Lavalle 456', rol: 'COCINERO', tarifaHora: 3000 }
  ]
  await prisma.empleado.createMany({ data: empleadosData })
  const empleados = await prisma.empleado.findMany()
  console.log('  OK\n')

  // --------------------------------
  // FASE 4: Mesas (12)
  // --------------------------------
  console.log('Creando 12 mesas...')
  const mesasData = [
    // Interior (mesas 1-7)
    { numero: 1, zona: 'Interior', capacidad: 4, posX: 100, posY: 100 },
    { numero: 2, zona: 'Interior', capacidad: 4, posX: 250, posY: 100 },
    { numero: 3, zona: 'Interior', capacidad: 6, posX: 100, posY: 250 },
    { numero: 4, zona: 'Interior', capacidad: 2, posX: 250, posY: 250 },
    { numero: 5, zona: 'Interior', capacidad: 4, posX: 400, posY: 100 },
    { numero: 6, zona: 'Interior', capacidad: 2, posX: 400, posY: 250 },
    { numero: 7, zona: 'Interior', capacidad: 2, posX: 550, posY: 100 },
    // Exterior (mesas 8-12)
    { numero: 8, zona: 'Exterior', capacidad: 4, posX: 100, posY: 100 },
    { numero: 9, zona: 'Exterior', capacidad: 4, posX: 250, posY: 100 },
    { numero: 10, zona: 'Exterior', capacidad: 6, posX: 400, posY: 100 },
    { numero: 11, zona: 'Exterior', capacidad: 8, posX: 100, posY: 250 },
    { numero: 12, zona: 'Exterior', capacidad: 10, posX: 350, posY: 250 }
  ]
  await prisma.mesa.createMany({ data: mesasData })
  const mesas = await prisma.mesa.findMany({ orderBy: { numero: 'asc' } })
  console.log('  OK\n')

  // --------------------------------
  // FASE 5: Categorias (7)
  // --------------------------------
  console.log('Creando 7 categorias...')
  const categoriasData = [
    { nombre: 'Hamburguesas', descripcion: 'Nuestras hamburguesas artesanales', orden: 1 },
    { nombre: 'Papas y Acompañamientos', descripcion: 'Papas fritas, aros y mas', orden: 2 },
    { nombre: 'Bebidas', descripcion: 'Gaseosas, jugos, cervezas', orden: 3 },
    { nombre: 'Postres', descripcion: 'Para los golosos', orden: 4 },
    { nombre: 'Combos', descripcion: 'Las mejores combinaciones', orden: 5 },
    { nombre: 'Pizzas', descripcion: 'Pizzas a la piedra', orden: 6 },
    { nombre: 'Empanadas', descripcion: 'Empanadas al horno', orden: 7 }
  ]
  await prisma.categoria.createMany({ data: categoriasData })
  const categorias = await prisma.categoria.findMany({ orderBy: { orden: 'asc' } })
  const catMap = {}
  for (const c of categorias) catMap[c.nombre] = c.id
  console.log('  OK\n')

  // --------------------------------
  // FASE 6: Ingredientes (20)
  // --------------------------------
  console.log('Creando 20 ingredientes (4 con stock critico)...')
  const ingredientesData = [
    { nombre: 'Carne de hamburguesa', unidad: 'unidades', stockActual: 100, stockMinimo: 20, costo: 800 },
    { nombre: 'Pan de hamburguesa', unidad: 'unidades', stockActual: 150, stockMinimo: 30, costo: 200 },
    { nombre: 'Queso cheddar', unidad: 'fetas', stockActual: 55, stockMinimo: 50, costo: 100 },
    { nombre: 'Bacon', unidad: 'fetas', stockActual: 22, stockMinimo: 25, costo: 150 },
    { nombre: 'Lechuga', unidad: 'hojas', stockActual: 80, stockMinimo: 20, costo: 30 },
    { nombre: 'Tomate', unidad: 'rodajas', stockActual: 100, stockMinimo: 30, costo: 50 },
    { nombre: 'Cebolla', unidad: 'aros', stockActual: 80, stockMinimo: 20, costo: 30 },
    { nombre: 'Papas', unidad: 'kg', stockActual: 30, stockMinimo: 10, costo: 500 },
    { nombre: 'Coca-Cola', unidad: 'unidades', stockActual: 48, stockMinimo: 12, costo: 400 },
    { nombre: 'Sprite', unidad: 'unidades', stockActual: 24, stockMinimo: 12, costo: 400 },
    { nombre: 'Agua mineral', unidad: 'unidades', stockActual: 36, stockMinimo: 12, costo: 200 },
    { nombre: 'Queso mozzarella', unidad: 'kg', stockActual: 8, stockMinimo: 5, costo: 3500 },
    { nombre: 'Salsa de tomate', unidad: 'litros', stockActual: 6, stockMinimo: 5, costo: 800 },
    { nombre: 'Harina', unidad: 'kg', stockActual: 50, stockMinimo: 15, costo: 600 },
    { nombre: 'Huevos', unidad: 'unidades', stockActual: 180, stockMinimo: 60, costo: 80 },
    { nombre: 'Dulce de leche', unidad: 'kg', stockActual: 1.5, stockMinimo: 2, costo: 2000 },
    { nombre: 'Cerveza Quilmes', unidad: 'unidades', stockActual: 120, stockMinimo: 40, costo: 600 },
    { nombre: 'Fernet Branca', unidad: 'litros', stockActual: 8, stockMinimo: 2, costo: 8000 },
    { nombre: 'Aceite', unidad: 'litros', stockActual: 20, stockMinimo: 5, costo: 2500 },
    { nombre: 'Helado', unidad: 'litros', stockActual: 10, stockMinimo: 3, costo: 4000 }
  ]
  await prisma.ingrediente.createMany({ data: ingredientesData })
  const ingredientes = await prisma.ingrediente.findMany()
  const ingMap = {}
  for (const i of ingredientes) ingMap[i.nombre] = i.id
  console.log('  OK\n')

  // --------------------------------
  // FASE 7: Productos (~20)
  // --------------------------------
  console.log('Creando productos...')
  const productosData = [
    { nombre: 'Hamburguesa Clasica', descripcion: 'Carne, lechuga, tomate, cebolla y mayonesa', precio: 4500, categoriaId: catMap['Hamburguesas'], destacado: true },
    { nombre: 'Hamburguesa con Queso', descripcion: 'Carne, queso cheddar, lechuga, tomate y mayonesa', precio: 5000, categoriaId: catMap['Hamburguesas'], destacado: true },
    { nombre: 'Hamburguesa Doble', descripcion: 'Doble carne, doble queso, bacon, lechuga y salsa especial', precio: 6500, categoriaId: catMap['Hamburguesas'], destacado: true },
    { nombre: 'Hamburguesa Bacon', descripcion: 'Carne, bacon crocante, queso, cebolla caramelizada', precio: 5500, categoriaId: catMap['Hamburguesas'] },
    { nombre: 'Hamburguesa Veggie', descripcion: 'Medallon de lentejas, lechuga, tomate, queso', precio: 4800, categoriaId: catMap['Hamburguesas'] },
    { nombre: 'Papas Fritas', descripcion: 'Porcion de papas fritas crocantes', precio: 1800, categoriaId: catMap['Papas y Acompañamientos'] },
    { nombre: 'Papas con Cheddar', descripcion: 'Papas fritas con salsa cheddar y bacon', precio: 2500, categoriaId: catMap['Papas y Acompañamientos'] },
    { nombre: 'Aros de Cebolla', descripcion: 'Porcion de aros de cebolla rebozados', precio: 2000, categoriaId: catMap['Papas y Acompañamientos'] },
    { nombre: 'Coca-Cola 500ml', descripcion: 'Gaseosa Coca-Cola', precio: 1200, categoriaId: catMap['Bebidas'] },
    { nombre: 'Sprite 500ml', descripcion: 'Gaseosa Sprite', precio: 1200, categoriaId: catMap['Bebidas'] },
    { nombre: 'Agua Mineral 500ml', descripcion: 'Agua mineral sin gas', precio: 800, categoriaId: catMap['Bebidas'] },
    { nombre: 'Cerveza Quilmes 500ml', descripcion: 'Cerveza rubia', precio: 1800, categoriaId: catMap['Bebidas'] },
    { nombre: 'Fernet con Coca', descripcion: 'Fernet Branca con Coca-Cola', precio: 2500, categoriaId: catMap['Bebidas'] },
    { nombre: 'Brownie con Helado', descripcion: 'Brownie de chocolate con helado de vainilla', precio: 2500, categoriaId: catMap['Postres'] },
    { nombre: 'Flan con Dulce de Leche', descripcion: 'Flan casero con dulce de leche y crema', precio: 2200, categoriaId: catMap['Postres'] },
    { nombre: 'Combo Clasico', descripcion: 'Hamburguesa clasica + Papas + Gaseosa', precio: 6800, categoriaId: catMap['Combos'], destacado: true },
    { nombre: 'Combo Doble', descripcion: 'Hamburguesa doble + Papas con cheddar + Gaseosa', precio: 9500, categoriaId: catMap['Combos'], destacado: true },
    { nombre: 'Pizza Muzzarella', descripcion: 'Pizza de muzzarella a la piedra', precio: 5500, categoriaId: catMap['Pizzas'] },
    { nombre: 'Pizza Napolitana', descripcion: 'Muzzarella, tomate y ajo', precio: 6000, categoriaId: catMap['Pizzas'] },
    { nombre: 'Empanadas x3', descripcion: 'Tres empanadas a eleccion (carne, pollo, jamon y queso)', precio: 3000, categoriaId: catMap['Empanadas'] },
    { nombre: 'Empanadas x6', descripcion: 'Seis empanadas a eleccion', precio: 5500, categoriaId: catMap['Empanadas'] }
  ]

  for (const p of productosData) {
    await prisma.producto.create({ data: p })
  }
  const productos = await prisma.producto.findMany()
  const prodMap = {}
  for (const p of productos) prodMap[p.nombre] = p

  const hamburguesas = productos.filter(p => p.categoriaId === catMap['Hamburguesas'])
  console.log(`  ${productos.length} productos creados\n`)

  // --------------------------------
  // FASE 8: Modificadores (12)
  // --------------------------------
  console.log('Creando 12 modificadores...')
  const modificadoresData = [
    { nombre: 'Sin cebolla', precio: 0, tipo: 'EXCLUSION' },
    { nombre: 'Sin tomate', precio: 0, tipo: 'EXCLUSION' },
    { nombre: 'Sin lechuga', precio: 0, tipo: 'EXCLUSION' },
    { nombre: 'Sin mayonesa', precio: 0, tipo: 'EXCLUSION' },
    { nombre: 'Sin pepinillos', precio: 0, tipo: 'EXCLUSION' },
    { nombre: 'Sin queso', precio: 0, tipo: 'EXCLUSION' },
    { nombre: 'Extra queso', precio: 800, tipo: 'ADICION' },
    { nombre: 'Extra bacon', precio: 1200, tipo: 'ADICION' },
    { nombre: 'Extra carne', precio: 2000, tipo: 'ADICION' },
    { nombre: 'Huevo frito', precio: 600, tipo: 'ADICION' },
    { nombre: 'Cebolla caramelizada', precio: 500, tipo: 'ADICION' },
    { nombre: 'Guacamole', precio: 900, tipo: 'ADICION' }
  ]
  await prisma.modificador.createMany({ data: modificadoresData })
  const modificadores = await prisma.modificador.findMany()
  console.log('  OK\n')

  // --------------------------------
  // FASE 9: ProductoModificador (~60 links)
  // --------------------------------
  console.log('Vinculando modificadores a productos...')
  const pmLinks = []
  for (const prod of hamburguesas) {
    for (const mod of modificadores) {
      pmLinks.push({ productoId: prod.id, modificadorId: mod.id })
    }
  }
  await prisma.productoModificador.createMany({ data: pmLinks })
  console.log(`  ${pmLinks.length} relaciones creadas\n`)

  // --------------------------------
  // FASE 10: ProductoIngrediente (~30 recetas)
  // --------------------------------
  console.log('Creando recetas producto-ingrediente...')
  const recetas = [
    // Hamburguesa Clasica
    { prod: 'Hamburguesa Clasica', ing: 'Carne de hamburguesa', cant: 1 },
    { prod: 'Hamburguesa Clasica', ing: 'Pan de hamburguesa', cant: 1 },
    { prod: 'Hamburguesa Clasica', ing: 'Lechuga', cant: 2 },
    { prod: 'Hamburguesa Clasica', ing: 'Tomate', cant: 2 },
    { prod: 'Hamburguesa Clasica', ing: 'Cebolla', cant: 3 },
    // Hamburguesa con Queso
    { prod: 'Hamburguesa con Queso', ing: 'Carne de hamburguesa', cant: 1 },
    { prod: 'Hamburguesa con Queso', ing: 'Pan de hamburguesa', cant: 1 },
    { prod: 'Hamburguesa con Queso', ing: 'Queso cheddar', cant: 2 },
    { prod: 'Hamburguesa con Queso', ing: 'Lechuga', cant: 2 },
    { prod: 'Hamburguesa con Queso', ing: 'Tomate', cant: 2 },
    // Hamburguesa Doble
    { prod: 'Hamburguesa Doble', ing: 'Carne de hamburguesa', cant: 2 },
    { prod: 'Hamburguesa Doble', ing: 'Pan de hamburguesa', cant: 1 },
    { prod: 'Hamburguesa Doble', ing: 'Queso cheddar', cant: 4 },
    { prod: 'Hamburguesa Doble', ing: 'Bacon', cant: 2 },
    { prod: 'Hamburguesa Doble', ing: 'Lechuga', cant: 2 },
    // Hamburguesa Bacon
    { prod: 'Hamburguesa Bacon', ing: 'Carne de hamburguesa', cant: 1 },
    { prod: 'Hamburguesa Bacon', ing: 'Pan de hamburguesa', cant: 1 },
    { prod: 'Hamburguesa Bacon', ing: 'Bacon', cant: 3 },
    { prod: 'Hamburguesa Bacon', ing: 'Queso cheddar', cant: 2 },
    { prod: 'Hamburguesa Bacon', ing: 'Cebolla', cant: 3 },
    // Papas
    { prod: 'Papas Fritas', ing: 'Papas', cant: 0.3 },
    { prod: 'Papas Fritas', ing: 'Aceite', cant: 0.1 },
    { prod: 'Papas con Cheddar', ing: 'Papas', cant: 0.3 },
    { prod: 'Papas con Cheddar', ing: 'Queso cheddar', cant: 3 },
    { prod: 'Papas con Cheddar', ing: 'Bacon', cant: 2 },
    // Bebidas
    { prod: 'Coca-Cola 500ml', ing: 'Coca-Cola', cant: 1 },
    { prod: 'Sprite 500ml', ing: 'Sprite', cant: 1 },
    { prod: 'Agua Mineral 500ml', ing: 'Agua mineral', cant: 1 },
    { prod: 'Cerveza Quilmes 500ml', ing: 'Cerveza Quilmes', cant: 1 },
    // Pizza
    { prod: 'Pizza Muzzarella', ing: 'Queso mozzarella', cant: 0.3 },
    { prod: 'Pizza Muzzarella', ing: 'Harina', cant: 0.25 },
    { prod: 'Pizza Muzzarella', ing: 'Salsa de tomate', cant: 0.1 },
    { prod: 'Pizza Napolitana', ing: 'Queso mozzarella', cant: 0.3 },
    { prod: 'Pizza Napolitana', ing: 'Harina', cant: 0.25 },
    { prod: 'Pizza Napolitana', ing: 'Salsa de tomate', cant: 0.15 },
    { prod: 'Pizza Napolitana', ing: 'Tomate', cant: 4 },
    // Postres
    { prod: 'Brownie con Helado', ing: 'Huevos', cant: 2 },
    { prod: 'Brownie con Helado', ing: 'Helado', cant: 0.1 },
    { prod: 'Flan con Dulce de Leche', ing: 'Huevos', cant: 3 },
    { prod: 'Flan con Dulce de Leche', ing: 'Dulce de leche', cant: 0.05 }
  ]

  const piData = recetas
    .filter(r => prodMap[r.prod] && ingMap[r.ing])
    .map(r => ({
      productoId: prodMap[r.prod].id,
      ingredienteId: ingMap[r.ing],
      cantidad: r.cant
    }))
  await prisma.productoIngrediente.createMany({ data: piData })
  console.log(`  ${piData.length} recetas creadas\n`)

  // --------------------------------
  // FASE 11: Pedidos (55+)
  // --------------------------------
  console.log('Creando pedidos...')

  const allProductos = productos
  const createdPedidos = []

  // Helper: generar items aleatorios para un pedido
  function generateItems(count) {
    const items = []
    const selected = pickN(allProductos, count)
    for (const prod of selected) {
      const cant = randInt(1, 3)
      items.push({
        productoId: prod.id,
        cantidad: cant,
        precioUnitario: Number(prod.precio),
        subtotal: Number(prod.precio) * cant
      })
    }
    return items
  }

  // Helper: crear un pedido completo
  async function crearPedido(data) {
    const items = data.items || generateItems(randInt(1, 4))
    const subtotal = items.reduce((s, i) => s + i.subtotal, 0)
    const costoEnvio = data.costoEnvio || 0
    const total = subtotal + costoEnvio

    const pedido = await prisma.pedido.create({
      data: {
        tipo: data.tipo,
        estado: data.estado,
        mesaId: data.mesaId || null,
        usuarioId: data.usuarioId || null,
        clienteNombre: data.clienteNombre || null,
        clienteTelefono: data.clienteTelefono || null,
        clienteDireccion: data.clienteDireccion || null,
        clienteEmail: data.clienteEmail || null,
        tipoEntrega: data.tipoEntrega || null,
        costoEnvio,
        subtotal,
        descuento: 0,
        total,
        observaciones: data.observaciones || null,
        estadoPago: data.estadoPago || 'PENDIENTE',
        origen: data.origen || 'INTERNO',
        impreso: data.impreso || false,
        createdAt: data.createdAt || new Date(),
        items: {
          create: items.map(i => ({
            productoId: i.productoId,
            cantidad: i.cantidad,
            precioUnitario: i.precioUnitario,
            subtotal: i.subtotal,
            observaciones: i.observaciones || null
          }))
        }
      },
      include: { items: true }
    })

    createdPedidos.push(pedido)

    // Agregar modificadores a items de hamburguesa (aleatorio)
    for (const item of pedido.items) {
      const isHamb = hamburguesas.some(h => h.id === item.productoId)
      if (isHamb && Math.random() > 0.4) {
        const numMods = randInt(1, 2)
        const selectedMods = pickN(modificadores, numMods)
        for (const mod of selectedMods) {
          await prisma.pedidoItemModificador.create({
            data: {
              pedidoItemId: item.id,
              modificadorId: mod.id,
              precio: Number(mod.precio)
            }
          })
        }
      }
    }

    return pedido
  }

  const clientesDelivery = [
    { nombre: 'Roberto Sanchez', tel: '1155550101', dir: 'Av. Cabildo 234' },
    { nombre: 'Valentina Lopez', tel: '1155550202', dir: 'Calle Arenales 567' },
    { nombre: 'Matias Garcia', tel: '1155550303', dir: 'Av. Las Heras 890' },
    { nombre: 'Camila Diaz', tel: '1155550404', dir: 'Calle Junin 123' },
    { nombre: 'Franco Moreno', tel: '1155550505', dir: 'Av. Cordoba 456' },
    { nombre: 'Lucia Ruiz', tel: '1155550606', dir: 'Calle Parana 789' }
  ]

  // --- Pedidos PENDIENTE (6) ---
  await crearPedido({ tipo: 'MESA', estado: 'PENDIENTE', mesaId: mesas[0].id, usuarioId: mozos[0].id, createdAt: new Date() })
  await crearPedido({ tipo: 'MESA', estado: 'PENDIENTE', mesaId: mesas[1].id, usuarioId: mozos[0].id, createdAt: new Date() })
  await crearPedido({ tipo: 'MESA', estado: 'PENDIENTE', mesaId: mesas[7].id, usuarioId: mozos[1].id, createdAt: new Date() })
  const cl1 = pick(clientesDelivery)
  await crearPedido({ tipo: 'DELIVERY', estado: 'PENDIENTE', usuarioId: mozos[0].id, clienteNombre: cl1.nombre, clienteTelefono: cl1.tel, clienteDireccion: cl1.dir, tipoEntrega: 'DELIVERY', costoEnvio: 1500, createdAt: new Date() })
  await crearPedido({ tipo: 'MOSTRADOR', estado: 'PENDIENTE', usuarioId: mozos[1].id, clienteNombre: 'Cliente Mostrador', createdAt: new Date() })
  const cl2 = pick(clientesDelivery)
  await crearPedido({ tipo: 'DELIVERY', estado: 'PENDIENTE', clienteNombre: cl2.nombre, clienteTelefono: cl2.tel, clienteDireccion: cl2.dir, clienteEmail: 'cliente@email.com', tipoEntrega: 'RETIRO', origen: 'MENU_PUBLICO', createdAt: new Date() })

  // --- Pedidos EN_PREPARACION (5) ---
  await crearPedido({ tipo: 'MESA', estado: 'EN_PREPARACION', mesaId: mesas[2].id, usuarioId: mozos[0].id, createdAt: randomDate(0, 0) })
  await crearPedido({ tipo: 'MESA', estado: 'EN_PREPARACION', mesaId: mesas[4].id, usuarioId: mozos[1].id, createdAt: randomDate(0, 0) })
  const cl3 = pick(clientesDelivery)
  await crearPedido({ tipo: 'DELIVERY', estado: 'EN_PREPARACION', usuarioId: mozos[0].id, clienteNombre: cl3.nombre, clienteTelefono: cl3.tel, clienteDireccion: cl3.dir, tipoEntrega: 'DELIVERY', costoEnvio: 1500, createdAt: randomDate(0, 0) })
  await crearPedido({ tipo: 'MOSTRADOR', estado: 'EN_PREPARACION', usuarioId: mozos[1].id, createdAt: randomDate(0, 0) })
  await crearPedido({ tipo: 'DELIVERY', estado: 'EN_PREPARACION', clienteNombre: 'Online Buyer', clienteEmail: 'online@test.com', tipoEntrega: 'DELIVERY', costoEnvio: 1500, origen: 'MENU_PUBLICO', createdAt: randomDate(0, 0) })

  // --- Pedidos LISTO (4) ---
  await crearPedido({ tipo: 'MESA', estado: 'LISTO', mesaId: mesas[5].id, usuarioId: mozos[0].id, createdAt: randomDate(0, 0) })
  await crearPedido({ tipo: 'MESA', estado: 'LISTO', mesaId: mesas[6].id, usuarioId: mozos[1].id, createdAt: randomDate(0, 0) })
  const cl4 = pick(clientesDelivery)
  await crearPedido({ tipo: 'DELIVERY', estado: 'LISTO', usuarioId: mozos[0].id, clienteNombre: cl4.nombre, clienteTelefono: cl4.tel, clienteDireccion: cl4.dir, tipoEntrega: 'DELIVERY', costoEnvio: 1500, createdAt: randomDate(0, 0) })
  await crearPedido({ tipo: 'MOSTRADOR', estado: 'LISTO', usuarioId: mozos[1].id, createdAt: randomDate(0, 0) })

  // --- Pedidos ENTREGADO (5) ---
  for (let i = 0; i < 5; i++) {
    const mesa = pick(mesas.slice(8, 12)) // VIP / Barra
    await crearPedido({ tipo: 'MESA', estado: 'ENTREGADO', mesaId: mesa.id, usuarioId: pick(mozos).id, createdAt: randomDate(3, 0) })
  }

  // --- Pedidos CANCELADO (5) ---
  for (let i = 0; i < 5; i++) {
    const createdAt = randomDate(30, 1)
    const tipo = pick(['MESA', 'DELIVERY', 'MOSTRADOR'])
    const data = { tipo, estado: 'CANCELADO', observaciones: pick(['Cliente se retiro', 'Error en pedido', 'Demora excesiva', 'Producto agotado', 'Duplicado']), createdAt }
    if (tipo === 'MESA') {
      data.mesaId = pick(mesas).id
      data.usuarioId = pick(mozos).id
    } else if (tipo === 'DELIVERY') {
      const cl = pick(clientesDelivery)
      data.clienteNombre = cl.nombre
      data.clienteTelefono = cl.tel
      data.clienteDireccion = cl.dir
      data.tipoEntrega = 'DELIVERY'
      data.costoEnvio = 1500
      data.usuarioId = pick(mozos).id
    } else {
      data.usuarioId = pick(mozos).id
    }
    await crearPedido(data)
  }

  // --- Pedidos COBRADO (30 — historicos, 1-2 por dia) ---
  for (let day = 1; day <= 30; day++) {
    const ordersThisDay = randInt(1, 2)
    for (let j = 0; j < ordersThisDay; j++) {
      const createdAt = randomDate(day, day - 1)
      const tipo = pick(['MESA', 'MESA', 'MESA', 'DELIVERY', 'MOSTRADOR']) // 60% mesa
      const data = { tipo, estado: 'COBRADO', estadoPago: 'APROBADO', impreso: true, createdAt }

      if (tipo === 'MESA') {
        data.mesaId = pick(mesas).id
        data.usuarioId = pick(mozos).id
      } else if (tipo === 'DELIVERY') {
        const cl = pick(clientesDelivery)
        data.clienteNombre = cl.nombre
        data.clienteTelefono = cl.tel
        data.clienteDireccion = cl.dir
        data.tipoEntrega = pick(['DELIVERY', 'RETIRO'])
        data.costoEnvio = data.tipoEntrega === 'DELIVERY' ? 1500 : 0
        data.usuarioId = pick(mozos).id
      } else {
        data.clienteNombre = pick(['Cliente Mostrador', 'Cliente Rapido', null])
        data.usuarioId = pick(mozos).id
      }

      await crearPedido(data)
    }
  }

  const pedidoCount = createdPedidos.length
  const itemCount = createdPedidos.reduce((s, p) => s + p.items.length, 0)
  const modCount = await prisma.pedidoItemModificador.count()
  console.log(`  ${pedidoCount} pedidos, ${itemCount} items, ${modCount} modificadores aplicados\n`)

  // --------------------------------
  // FASE 12: Pagos (35+)
  // --------------------------------
  console.log('Creando pagos...')
  const pedidosCobrados = createdPedidos.filter(p => p.estado === 'COBRADO')
  const pedidosEntregados = createdPedidos.filter(p => p.estado === 'ENTREGADO')
  const pedidosConPago = [...pedidosCobrados, ...pedidosEntregados]

  let pagoCount = 0
  const metodos = ['EFECTIVO', 'EFECTIVO', 'EFECTIVO', 'TARJETA', 'TARJETA', 'MERCADOPAGO', 'MERCADOPAGO', 'TRANSFERENCIA']

  for (const pedido of pedidosConPago) {
    const metodo = pick(metodos)
    const monto = Number(pedido.total)
    const pagoData = {
      pedidoId: pedido.id,
      monto,
      metodo,
      estado: pedido.estado === 'COBRADO' ? 'APROBADO' : 'PENDIENTE',
      idempotencyKey: crypto.randomUUID(),
      createdAt: pedido.createdAt
    }

    if (metodo === 'EFECTIVO') {
      const montoAbonado = Math.ceil(monto / 1000) * 1000
      pagoData.montoAbonado = montoAbonado
      pagoData.vuelto = montoAbonado - monto
    } else if (metodo === 'MERCADOPAGO') {
      pagoData.mpPreferenceId = `SEED-pref-${crypto.randomUUID().slice(0, 8)}`
      pagoData.mpPaymentId = `SEED-pay-${crypto.randomUUID().slice(0, 8)}`
      pagoData.referencia = pagoData.mpPaymentId
    } else if (metodo === 'TARJETA') {
      pagoData.referencia = `TAR-${String(pagoCount + 1).padStart(4, '0')}`
    } else if (metodo === 'TRANSFERENCIA') {
      pagoData.referencia = `TRANS-${String(pagoCount + 1).padStart(4, '0')}`
    }

    await prisma.pago.create({ data: pagoData })
    pagoCount++
  }
  console.log(`  ${pagoCount} pagos creados\n`)

  // --------------------------------
  // FASE 13: Movimientos de Stock (~50)
  // --------------------------------
  console.log('Creando movimientos de stock...')
  const movimientos = []

  for (const ing of ingredientes) {
    // Compra inicial (28 dias atras)
    movimientos.push({
      ingredienteId: ing.id,
      tipo: 'ENTRADA',
      cantidad: Number(ing.stockActual) * 2,
      motivo: 'Compra inicial proveedor',
      createdAt: randomDate(30, 26)
    })

    // Reposicion (14 dias atras)
    movimientos.push({
      ingredienteId: ing.id,
      tipo: 'ENTRADA',
      cantidad: Math.round(Number(ing.stockActual) * 0.5 * 100) / 100,
      motivo: 'Reposicion semanal',
      createdAt: randomDate(16, 12)
    })

    // Consumo (7 dias atras)
    movimientos.push({
      ingredienteId: ing.id,
      tipo: 'SALIDA',
      cantidad: Math.round(Number(ing.stockActual) * 0.3 * 100) / 100,
      motivo: 'Consumo operativo',
      createdAt: randomDate(8, 5)
    })
  }

  // Ajustes especificos
  const ajustes = [
    { ing: 'Bacon', cant: -3, motivo: 'Ajuste por inventario fisico - faltante' },
    { ing: 'Dulce de leche', cant: -0.5, motivo: 'Merma por vencimiento' },
    { ing: 'Papas', cant: 2, motivo: 'Ajuste inventario - sobrante encontrado' },
    { ing: 'Huevos', cant: -10, motivo: 'Rotura de mercaderia' }
  ]
  for (const aj of ajustes) {
    if (ingMap[aj.ing]) {
      movimientos.push({
        ingredienteId: ingMap[aj.ing],
        tipo: 'AJUSTE',
        cantidad: aj.cant,
        motivo: aj.motivo,
        createdAt: randomDate(3, 1)
      })
    }
  }

  await prisma.movimientoStock.createMany({ data: movimientos })
  console.log(`  ${movimientos.length} movimientos creados\n`)

  // --------------------------------
  // FASE 14: Reservas (25)
  // --------------------------------
  console.log('Creando reservas...')
  const clientesReserva = [
    'Roberto Sanchez', 'Maria Fernandez', 'Carlos Gomez', 'Ana Rodriguez',
    'Lucas Martinez', 'Sofia Perez', 'Diego Alvarez', 'Valentina Lopez',
    'Matias Garcia', 'Camila Diaz', 'Juan Pablo Moreno', 'Florencia Ruiz',
    'Agustin Herrera', 'Martina Acosta', 'Federico Sosa', 'Carolina Mendez',
    'Gonzalo Torres', 'Julieta Castro', 'Nicolas Rios', 'Paula Dominguez',
    'Tomas Romero', 'Brenda Gutierrez', 'Sebastian Medina', 'Natalia Suarez',
    'Andres Figueroa'
  ]

  const horariosReserva = [12, 13, 20, 20.5, 21, 21.5]
  const reservasData = []

  // 8 CONFIRMADA (futuras, proximos 7 dias)
  for (let i = 0; i < 8; i++) {
    const d = daysFromNow(randInt(1, 7))
    const hora = pick(horariosReserva)
    d.setHours(Math.floor(hora), (hora % 1) * 60, 0, 0)
    reservasData.push({
      mesaId: pick(mesas).id,
      clienteNombre: clientesReserva[i],
      clienteTelefono: `11${randInt(40000000, 49999999)}`,
      fechaHora: d,
      cantidadPersonas: randInt(2, 6),
      estado: 'CONFIRMADA',
      observaciones: i === 0 ? 'Cumpleanos, pedir torta' : (i === 3 ? 'Alergico al mani' : null)
    })
  }

  // 3 CLIENTE_PRESENTE (hoy)
  for (let i = 0; i < 3; i++) {
    const d = new Date(now)
    d.setHours(pick([12, 13, 20]), 0, 0, 0)
    reservasData.push({
      mesaId: mesas[9 + i].id, // VIP tables
      clienteNombre: clientesReserva[8 + i],
      clienteTelefono: `11${randInt(40000000, 49999999)}`,
      fechaHora: d,
      cantidadPersonas: randInt(2, 8),
      estado: 'CLIENTE_PRESENTE'
    })
  }

  // 5 NO_LLEGO (ultimos 7 dias)
  for (let i = 0; i < 5; i++) {
    const d = daysAgo(randInt(1, 7))
    d.setHours(pick([20, 21]), 0, 0, 0)
    reservasData.push({
      mesaId: pick(mesas).id,
      clienteNombre: clientesReserva[11 + i],
      clienteTelefono: `11${randInt(40000000, 49999999)}`,
      fechaHora: d,
      cantidadPersonas: randInt(2, 4),
      estado: 'NO_LLEGO'
    })
  }

  // 4 CANCELADA (pasado)
  for (let i = 0; i < 4; i++) {
    const d = daysAgo(randInt(2, 14))
    d.setHours(pick([12, 20, 21]), 0, 0, 0)
    reservasData.push({
      mesaId: pick(mesas).id,
      clienteNombre: clientesReserva[16 + i],
      clienteTelefono: `11${randInt(40000000, 49999999)}`,
      fechaHora: d,
      cantidadPersonas: randInt(2, 6),
      estado: 'CANCELADA',
      observaciones: pick(['Cancelada por el cliente', 'Cambio de planes', null])
    })
  }

  // 5 historicas cumplidas (ya pasaron, estado CONFIRMADA)
  for (let i = 0; i < 5; i++) {
    const d = daysAgo(randInt(8, 25))
    d.setHours(pick([12, 13, 20, 21]), 0, 0, 0)
    reservasData.push({
      mesaId: pick(mesas).id,
      clienteNombre: clientesReserva[20 + i],
      clienteTelefono: `11${randInt(40000000, 49999999)}`,
      fechaHora: d,
      cantidadPersonas: randInt(2, 8),
      estado: 'CONFIRMADA'
    })
  }

  await prisma.reserva.createMany({ data: reservasData })
  console.log(`  ${reservasData.length} reservas creadas\n`)

  // --------------------------------
  // FASE 15: Fichajes (~80)
  // --------------------------------
  console.log('Creando fichajes...')
  const fichajesData = []

  for (let day = 0; day < 14; day++) {
    const fecha = new Date(now)
    fecha.setDate(fecha.getDate() - day)
    fecha.setHours(0, 0, 0, 0)

    // Skip domingos
    if (fecha.getDay() === 0) continue

    for (const emp of empleados) {
      // Algunos dias faltan (15% chance)
      if (Math.random() < 0.15) continue

      const entrada = new Date(fecha)
      entrada.setHours(10 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 30), 0, 0)

      const salida = new Date(fecha)
      salida.setHours(20 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 60), 0, 0)

      // Hoy: algunos sin salida (estan trabajando)
      const tieneSalida = day > 0 || Math.random() > 0.5

      fichajesData.push({
        empleadoId: emp.id,
        entrada,
        salida: tieneSalida ? salida : null,
        fecha: dateOnly(fecha)
      })
    }
  }

  await prisma.fichaje.createMany({ data: fichajesData })
  console.log(`  ${fichajesData.length} fichajes creados\n`)

  // --------------------------------
  // FASE 16: Liquidaciones (8)
  // --------------------------------
  console.log('Creando liquidaciones...')
  const inicioMesAnt = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const finMesAnt = new Date(now.getFullYear(), now.getMonth(), 0)
  const liquidacionesData = []

  for (const emp of empleados) {
    const horasTotales = 140 + Math.floor(Math.random() * 40) // 140-180
    const tarifaHora = Number(emp.tarifaHora)
    const subtotal = horasTotales * tarifaHora
    const descuentos = Math.random() > 0.7 ? Math.floor(Math.random() * 10000) : 0
    const adicionales = Math.random() > 0.5 ? Math.floor(Math.random() * 20000) : 0
    const totalPagar = subtotal - descuentos + adicionales
    const pagado = Math.random() > 0.3

    liquidacionesData.push({
      empleadoId: emp.id,
      periodoDesde: dateOnly(inicioMesAnt),
      periodoHasta: dateOnly(finMesAnt),
      horasTotales,
      tarifaHora,
      subtotal,
      descuentos,
      adicionales,
      totalPagar,
      observaciones: pagado ? null : 'Pendiente de pago',
      pagado,
      fechaPago: pagado ? new Date(now.getFullYear(), now.getMonth(), 5) : null
    })
  }

  await prisma.liquidacion.createMany({ data: liquidacionesData })
  console.log(`  ${liquidacionesData.length} liquidaciones creadas\n`)

  // --------------------------------
  // FASE 17: Cierres de Caja (10)
  // --------------------------------
  console.log('Creando cierres de caja...')
  const cierresData = []
  let cierreDays = 0

  for (let day = 0; cierreDays < 10; day++) {
    const fecha = new Date(now)
    fecha.setDate(fecha.getDate() - day)
    fecha.setHours(0, 0, 0, 0)

    if (fecha.getDay() === 0) continue // skip domingos

    const isToday = day === 0
    const horaApertura = new Date(fecha)
    horaApertura.setHours(10, 0, 0, 0)

    const horaCierre = isToday ? null : new Date(fecha)
    if (horaCierre) horaCierre.setHours(23, 30, 0, 0)

    const totalEfectivo = isToday ? 0 : 50000 + Math.floor(Math.random() * 80000)
    const totalTarjeta = isToday ? 0 : 20000 + Math.floor(Math.random() * 40000)
    const totalMP = isToday ? 0 : 15000 + Math.floor(Math.random() * 30000)
    const fondoInicial = 20000
    const efectivoFisico = isToday ? null : totalEfectivo + fondoInicial + (Math.random() > 0.7 ? randInt(-1500, 1500) : 0)
    const diferencia = isToday ? null : (efectivoFisico !== null ? efectivoFisico - (totalEfectivo + fondoInicial) : 0)

    cierresData.push({
      usuarioId: cajero ? cajero.id : admin.id,
      fecha: dateOnly(fecha),
      horaApertura,
      horaCierre,
      fondoInicial,
      totalEfectivo,
      totalTarjeta,
      totalMP,
      efectivoFisico,
      diferencia,
      estado: isToday ? 'ABIERTO' : 'CERRADO',
      observaciones: isToday ? 'Caja del dia' : (diferencia && diferencia !== 0 ? `Diferencia de $${diferencia}` : null)
    })

    cierreDays++
  }

  await prisma.cierreCaja.createMany({ data: cierresData })
  console.log(`  ${cierresData.length} cierres creados\n`)

  // --------------------------------
  // FASE 18: Print Jobs (~15)
  // --------------------------------
  console.log('Creando print jobs...')
  const recentPedidos = createdPedidos
    .filter(p => new Date(p.createdAt) > daysAgo(3))
    .slice(0, 5)

  const printJobsData = []
  for (const pedido of recentPedidos) {
    const batchId = crypto.randomUUID()
    const tipos = ['COCINA', 'CAJA', 'CLIENTE']

    for (const tipo of tipos) {
      let status = 'OK'
      let lastError = null
      let intentos = 1

      if (pedido.estado === 'CANCELADO') {
        status = 'ERROR'
        lastError = 'Pedido cancelado antes de imprimir'
        intentos = 3
      } else if (pedido.estado === 'PENDIENTE' || pedido.estado === 'EN_PREPARACION') {
        status = 'PENDIENTE'
        intentos = 0
      }

      printJobsData.push({
        pedidoId: pedido.id,
        tipo,
        status,
        intentos,
        maxIntentos: 3,
        nextAttemptAt: new Date(),
        lastError,
        contenido: `[SEED] Comanda ${tipo} - Pedido #${pedido.id}`,
        anchoMm: 80,
        batchId
      })
    }
  }

  // Agregar un job con ERROR para probar UI
  if (createdPedidos.length > 0) {
    const errorPedido = createdPedidos[createdPedidos.length - 1]
    const errorBatchId = crypto.randomUUID()
    printJobsData.push({
      pedidoId: errorPedido.id,
      tipo: 'COCINA',
      status: 'ERROR',
      intentos: 3,
      maxIntentos: 3,
      nextAttemptAt: new Date(),
      lastError: 'Impresora no responde - timeout 5000ms',
      contenido: `[SEED] Comanda COCINA - Pedido #${errorPedido.id} (error)`,
      anchoMm: 80,
      batchId: errorBatchId
    })
  }

  await prisma.printJob.createMany({ data: printJobsData })
  console.log(`  ${printJobsData.length} print jobs creados\n`)

  // --------------------------------
  // FASE 19: Actualizar estados de mesas
  // --------------------------------
  console.log('Actualizando estados de mesas...')

  // Reset all to LIBRE first
  await prisma.mesa.updateMany({ data: { estado: 'LIBRE' } })

  // Tables with active orders -> OCUPADA
  const activePedidos = await prisma.pedido.findMany({
    where: {
      mesaId: { not: null },
      estado: { in: ['PENDIENTE', 'EN_PREPARACION', 'LISTO', 'ENTREGADO'] }
    },
    select: { mesaId: true }
  })
  const occupiedIds = [...new Set(activePedidos.map(p => p.mesaId).filter(Boolean))]

  if (occupiedIds.length > 0) {
    await prisma.mesa.updateMany({
      where: { id: { in: occupiedIds } },
      data: { estado: 'OCUPADA' }
    })
  }

  // Tables with today's CONFIRMADA reservations -> RESERVADA (if not occupied)
  const todayStart = dateOnly(now)
  const tomorrowStart = daysFromNow(1)
  tomorrowStart.setHours(0, 0, 0, 0)

  const todayReservations = await prisma.reserva.findMany({
    where: {
      estado: 'CONFIRMADA',
      fechaHora: { gte: todayStart, lt: tomorrowStart }
    },
    select: { mesaId: true }
  })
  const reservedIds = todayReservations
    .map(r => r.mesaId)
    .filter(id => !occupiedIds.includes(id))

  if (reservedIds.length > 0) {
    await prisma.mesa.updateMany({
      where: { id: { in: reservedIds } },
      data: { estado: 'RESERVADA' }
    })
  }

  const mesaStats = await prisma.mesa.groupBy({ by: ['estado'], _count: true })
  const mesaStatsStr = mesaStats.map(s => `${s._count} ${s.estado}`).join(', ')
  console.log(`  ${mesaStatsStr}\n`)

  // --------------------------------
  // FASE 20: Resumen
  // --------------------------------
  console.log('='.repeat(50))
  console.log('  SEED MASIVO COMPLETADO')
  console.log('='.repeat(50))

  const counts = {
    usuarios: await prisma.usuario.count(),
    empleados: await prisma.empleado.count(),
    mesas: await prisma.mesa.count(),
    categorias: await prisma.categoria.count(),
    productos: await prisma.producto.count(),
    modificadores: await prisma.modificador.count(),
    productoModificador: await prisma.productoModificador.count(),
    ingredientes: await prisma.ingrediente.count(),
    productoIngrediente: await prisma.productoIngrediente.count(),
    pedidos: await prisma.pedido.count(),
    pedidoItems: await prisma.pedidoItem.count(),
    pedidoItemMods: await prisma.pedidoItemModificador.count(),
    pagos: await prisma.pago.count(),
    movimientosStock: await prisma.movimientoStock.count(),
    reservas: await prisma.reserva.count(),
    fichajes: await prisma.fichaje.count(),
    liquidaciones: await prisma.liquidacion.count(),
    cierresCaja: await prisma.cierreCaja.count(),
    printJobs: await prisma.printJob.count(),
    configuraciones: await prisma.configuracion.count()
  }

  console.log('\nDatos creados:')
  for (const [key, val] of Object.entries(counts)) {
    console.log(`  ${key.padEnd(22)} ${val}`)
  }

  console.log('\nCredenciales (password: test123):')
  console.log('  admin@comanda.app      ADMIN')
  console.log('  mozo@comanda.app       MOZO')
  console.log('  mozo2@comanda.app      MOZO')
  console.log('  cocinero@comanda.app   COCINERO')
  console.log('  cocinero2@comanda.app  COCINERO')
  console.log('  cajero@comanda.app     CAJERO')
  console.log('  delivery@comanda.app   DELIVERY')

  console.log('\nAlertas de stock:')
  const alertas = await prisma.ingrediente.findMany({
    where: { stockActual: { lte: prisma.ingrediente.fields?.stockMinimo } }
  }).catch(() => [])
  // Manual check since Prisma doesn't support field-to-field comparison easily
  for (const ing of ingredientes) {
    if (Number(ing.stockActual) <= Number(ing.stockMinimo) * 1.15) {
      const status = Number(ing.stockActual) < Number(ing.stockMinimo) ? 'POR DEBAJO' : 'CERCA'
      console.log(`  ${ing.nombre}: ${ing.stockActual}/${ing.stockMinimo} (${status})`)
    }
  }

  console.log('')
}

main()
  .catch((e) => {
    console.error('Error en seed masivo:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
