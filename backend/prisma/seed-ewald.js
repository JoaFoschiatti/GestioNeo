const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('🗑️  Limpiando datos existentes...')

  // Eliminar en orden correcto por foreign keys
  await prisma.pedidoItem.deleteMany({})
  await prisma.productoIngrediente.deleteMany({})
  await prisma.producto.deleteMany({})
  await prisma.categoria.deleteMany({})

  console.log('📁 Creando categorías...')

  const hamburguesa = await prisma.categoria.create({
    data: { nombre: 'Hamburguesa', orden: 1, activa: true }
  })

  const pizzas = await prisma.categoria.create({
    data: { nombre: 'Pizzas', orden: 2, activa: true }
  })

  const paraPicar = await prisma.categoria.create({
    data: { nombre: 'Para Picar', orden: 3, activa: true }
  })

  const salsas = await prisma.categoria.create({
    data: { nombre: 'Salsas', orden: 4, activa: true }
  })

  console.log('🍔 Creando productos...')

  // Hamburguesas (32 productos)
  const hamburguesasData = [
    { nombre: 'Crispy Bacon Simple', descripcion: 'Pan de Producción Propia, Cebolla Crispy, Panceta, Salsa Estilo Guacamole, Queso Cheddar', precio: 10500 },
    { nombre: 'Crispy Bacon Doble', descripcion: 'Pan de Producción Propia, Cebolla Crispy, Panceta, Salsa Estilo Guacamole, Queso Cheddar', precio: 11900 },
    { nombre: 'Crispy Bacon Triple', descripcion: 'Pan de Producción Propia, Cebolla Crispy, Panceta, Salsa Estilo Guacamole, Queso Cheddar', precio: 13900 },
    { nombre: 'Honey Sky Simple', descripcion: 'Mostaza y Miel, Champiñones a la manteca, Bife 100gr, Queso Azul', precio: 10200 },
    { nombre: 'Honey Sky Doble', descripcion: 'Mostaza y Miel, Champiñones a la manteca, 2 Bife 100gr, Queso Azul', precio: 11600 },
    { nombre: 'Honey Sky Triple', descripcion: 'Mostaza y Miel, Champiñones a la manteca, 3 Bife 100gr, Queso Azul', precio: 13200 },
    { nombre: 'Ewald Burger Doble', descripcion: '2 Bife 100gr, Cheddar, Panceta Ahumada, Huevo, Aros de cebolla, Salsa BBQ', precio: 11900 },
    { nombre: 'Ewald Burger Triple', descripcion: '3 Bife 100gr, Cheddar, Panceta Ahumada, Huevo, Aros de Cebolla, Salsa BBQ', precio: 13900 },
    { nombre: 'Ewald Burger Cuadruple', descripcion: '4 Bife 100gr, Cheddar, Panceta Ahumada, Huevo, Aros de Cebolla, Salsa BBQ', precio: 16000 },
    { nombre: 'Bacon Burger Simple', descripcion: 'Bife 100gr, Cheddar, Mayonesa Casera, Panceta ahumada', precio: 10200 },
    { nombre: 'Bacon Burger Doble', descripcion: '2 Bife 100gr, Cheddar, Panceta ahumada, Mayonesa casera', precio: 11600 },
    { nombre: 'Bacon Burger Triple', descripcion: '3 Bife 100gr, Cheddar, Panceta Ahumada, Mayonesa Casera', precio: 13600 },
    { nombre: 'Cheese Burger Simple', descripcion: 'Bife 100gr, Cheddar, Cebolla Cruda, Salsa Ewald', precio: 9900 },
    { nombre: 'Cheese Burger Doble', descripcion: '2 Bife 100gr, Cheddar, Cebolla Cruda, Salsa Ewald', precio: 11400 },
    { nombre: 'Cheese Burger Triple', descripcion: '3 Bife 100gr, Cheddar, Cebolla cruda, Salsa Ewald', precio: 13400 },
    { nombre: 'Blue Burger Simple', descripcion: 'Bife 100gr, Queso Azul, Cebolla Caramelizada, Salsa BBQ', precio: 10300 },
    { nombre: 'Blue Burger Doble', descripcion: '2 Bife 100gr, Queso Azul, Cebolla caramelizada, Salsa BBQ', precio: 11600 },
    { nombre: 'Blue Burger Triple', descripcion: '3 Bife 100gr, Queso Azul, Cebolla Caramelizada, Salsa BBQ', precio: 13600 },
    { nombre: 'Smoke Burger Simple', descripcion: 'Bife 100gr, Queso Ahumado, Rúcula, Panceta Ahumada, Salsa BBQ', precio: 10400 },
    { nombre: 'Smoke Burger Doble', descripcion: '2 Bife 100gr, Queso Ahumado, Rúcula, Panceta Ahumada, Salsa BBQ', precio: 11900 },
    { nombre: 'Smoke Burger Triple', descripcion: '3 Bife 100gr, Queso Ahumado, Rúcula, Panceta Ahumada, Salsa BBQ', precio: 13900 },
    { nombre: 'Classic Burger Simple', descripcion: 'Bife 100gr, Queso Muzzarella, Lechuga, Tomate, Huevo, Salsa Ewald', precio: 9700 },
    { nombre: 'Classic Burger Doble', descripcion: '2 Bife 100gr, Queso Muzzarella, Lechuga, Tomate, Huevo, Salsa Ewald', precio: 11200 },
    { nombre: 'Classic Burger Triple', descripcion: '3 Bife 100gr, Queso Muzzarella, Lechuga, Tomate, Huevo, Salsa Ewald', precio: 12700 },
    { nombre: 'Criolla Burger Simple', descripcion: 'Bife 100gr, Queso Muzzarella, Salsa Criolla, Mayonesa Casera', precio: 9500 },
    { nombre: 'Criolla Burger Doble', descripcion: '2 Bife 100gr, Queso Muzzarella, Salsa Criolla, Mayonesa Casera', precio: 11000 },
    { nombre: 'Criolla Burger Triple', descripcion: '3 Bife 100gr, Queso Muzzarella, Salsa Criolla, Mayonesa Casera', precio: 12600 },
    { nombre: 'Demon Burger Simple', descripcion: 'Bife 100gr, Queso Muzzarella, Lechuga, Tomate, Huevo, Salsa Picante', precio: 9600 },
    { nombre: 'Demon Burger Doble', descripcion: '2 Bife 100gr, Queso Muzzarella, Lechuga, Tomate, Huevo, Salsa Picante', precio: 11200 },
    { nombre: 'Demon Burger Triple', descripcion: '3 Bife 100gr, Queso Muzzarella, Lechuga, Tomate, Huevo, Salsa Picante', precio: 12800 },
    { nombre: 'Veggie Burger', descripcion: 'Armala como quieras!', precio: 9500 },
    { nombre: 'Fried Chicken', descripcion: 'Pollo frito crocante', precio: 9000 },
  ]

  // Pizzas (3 productos)
  const pizzasData = [
    { nombre: 'Pizza Ewald', descripcion: 'Pizza especial de la casa', precio: 12000 },
    { nombre: 'Media Ewald', descripcion: 'Media pizza especial de la casa', precio: 6500 },
    { nombre: 'Muzzarela', descripcion: 'Pizza de muzzarella', precio: 11000 },
  ]

  // Para Picar (2 productos)
  const paraPicarData = [
    { nombre: 'Papas', descripcion: 'Papas fritas', precio: 6000 },
    { nombre: 'Nuggets', descripcion: 'Nuggets de pollo', precio: 7000 },
  ]

  // Salsas (1 producto)
  const salsasData = [
    { nombre: 'Mayonesa casera', descripcion: 'Mayonesa casera artesanal', precio: 600 },
  ]

  // Insertar productos
  let totalProductos = 0

  for (const prod of hamburguesasData) {
    await prisma.producto.create({
      data: {
        nombre: prod.nombre,
        descripcion: prod.descripcion,
        precio: prod.precio,
        categoriaId: hamburguesa.id,
        disponible: true,
        destacado: false,
      }
    })
    totalProductos++
  }

  for (const prod of pizzasData) {
    await prisma.producto.create({
      data: {
        nombre: prod.nombre,
        descripcion: prod.descripcion,
        precio: prod.precio,
        categoriaId: pizzas.id,
        disponible: true,
        destacado: false,
      }
    })
    totalProductos++
  }

  for (const prod of paraPicarData) {
    await prisma.producto.create({
      data: {
        nombre: prod.nombre,
        descripcion: prod.descripcion,
        precio: prod.precio,
        categoriaId: paraPicar.id,
        disponible: true,
        destacado: false,
      }
    })
    totalProductos++
  }

  for (const prod of salsasData) {
    await prisma.producto.create({
      data: {
        nombre: prod.nombre,
        descripcion: prod.descripcion,
        precio: prod.precio,
        categoriaId: salsas.id,
        disponible: true,
        destacado: false,
      }
    })
    totalProductos++
  }

  console.log('')
  console.log('✅ Menú de Estación Ewald cargado exitosamente')
  console.log(`   📁 4 categorías creadas`)
  console.log(`   🍔 ${totalProductos} productos creados`)
  console.log('')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
