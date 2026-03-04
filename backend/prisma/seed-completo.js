const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed completo de datos de prueba...\n');

  // ============================================
  // 1. TENANT
  // ============================================
  console.log('Creando tenant...');
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'restaurante-demo' },
    update: {},
    create: {
      slug: 'restaurante-demo',
      nombre: 'Restaurante Demo',
      email: 'demo@gestioNeo.com',
      telefono: '+54 11 1234-5678',
      direccion: 'Av. Corrientes 1234, CABA',
      colorPrimario: '#E11D48',
      colorSecundario: '#BE123C',
      plan: 'PRO',
      activo: true,
    },
  });
  console.log(`  - Tenant: ${tenant.nombre} (${tenant.slug})\n`);

  // ============================================
  // 2. USUARIOS
  // ============================================
  console.log('Creando usuarios...');
  const passwordHash = await bcrypt.hash('demo123', 10);

  const usuarios = await Promise.all([
    prisma.usuario.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: 'admin@demo.com' } },
      update: {},
      create: {
        tenantId: tenant.id,
        email: 'admin@demo.com',
        password: passwordHash,
        nombre: 'Admin Demo',
        rol: 'ADMIN',
        activo: true,
      },
    }),
    prisma.usuario.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: 'mozo1@demo.com' } },
      update: {},
      create: {
        tenantId: tenant.id,
        email: 'mozo1@demo.com',
        password: passwordHash,
        nombre: 'Juan Perez',
        rol: 'MOZO',
        activo: true,
      },
    }),
    prisma.usuario.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: 'mozo2@demo.com' } },
      update: {},
      create: {
        tenantId: tenant.id,
        email: 'mozo2@demo.com',
        password: passwordHash,
        nombre: 'Maria Garcia',
        rol: 'MOZO',
        activo: true,
      },
    }),
    prisma.usuario.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: 'cocinero@demo.com' } },
      update: {},
      create: {
        tenantId: tenant.id,
        email: 'cocinero@demo.com',
        password: passwordHash,
        nombre: 'Carlos Chef',
        rol: 'COCINERO',
        activo: true,
      },
    }),
    prisma.usuario.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: 'cajero@demo.com' } },
      update: {},
      create: {
        tenantId: tenant.id,
        email: 'cajero@demo.com',
        password: passwordHash,
        nombre: 'Ana Caja',
        rol: 'CAJERO',
        activo: true,
      },
    }),
    prisma.usuario.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: 'delivery@demo.com' } },
      update: {},
      create: {
        tenantId: tenant.id,
        email: 'delivery@demo.com',
        password: passwordHash,
        nombre: 'Pedro Delivery',
        rol: 'DELIVERY',
        activo: true,
      },
    }),
  ]);
  console.log(`  - ${usuarios.length} usuarios creados\n`);

  // ============================================
  // 3. EMPLEADOS
  // ============================================
  console.log('Creando empleados...');
  const empleados = await Promise.all([
    prisma.empleado.upsert({
      where: { tenantId_dni: { tenantId: tenant.id, dni: '30123456' } },
      update: {},
      create: {
        tenantId: tenant.id,
        nombre: 'Juan',
        apellido: 'Perez',
        dni: '30123456',
        telefono: '1155551234',
        direccion: 'Calle Falsa 123',
        rol: 'MOZO',
        tarifaHora: 1500,
        activo: true,
      },
    }),
    prisma.empleado.upsert({
      where: { tenantId_dni: { tenantId: tenant.id, dni: '30234567' } },
      update: {},
      create: {
        tenantId: tenant.id,
        nombre: 'Maria',
        apellido: 'Garcia',
        dni: '30234567',
        telefono: '1155552345',
        direccion: 'Av. Siempreviva 742',
        rol: 'MOZO',
        tarifaHora: 1500,
        activo: true,
      },
    }),
    prisma.empleado.upsert({
      where: { tenantId_dni: { tenantId: tenant.id, dni: '30345678' } },
      update: {},
      create: {
        tenantId: tenant.id,
        nombre: 'Carlos',
        apellido: 'Martinez',
        dni: '30345678',
        telefono: '1155553456',
        direccion: 'Pasaje Oculto 456',
        rol: 'COCINERO',
        tarifaHora: 1800,
        activo: true,
      },
    }),
    prisma.empleado.upsert({
      where: { tenantId_dni: { tenantId: tenant.id, dni: '30456789' } },
      update: {},
      create: {
        tenantId: tenant.id,
        nombre: 'Laura',
        apellido: 'Lopez',
        dni: '30456789',
        telefono: '1155554567',
        direccion: 'Boulevard Principal 789',
        rol: 'COCINERO',
        tarifaHora: 1800,
        activo: true,
      },
    }),
    prisma.empleado.upsert({
      where: { tenantId_dni: { tenantId: tenant.id, dni: '30567890' } },
      update: {},
      create: {
        tenantId: tenant.id,
        nombre: 'Ana',
        apellido: 'Rodriguez',
        dni: '30567890',
        telefono: '1155555678',
        direccion: 'Diagonal Norte 321',
        rol: 'CAJERO',
        tarifaHora: 1600,
        activo: true,
      },
    }),
    prisma.empleado.upsert({
      where: { tenantId_dni: { tenantId: tenant.id, dni: '30678901' } },
      update: {},
      create: {
        tenantId: tenant.id,
        nombre: 'Pedro',
        apellido: 'Gomez',
        dni: '30678901',
        telefono: '1155556789',
        direccion: 'Calle del Sol 999',
        rol: 'DELIVERY',
        tarifaHora: 1400,
        activo: true,
      },
    }),
  ]);
  console.log(`  - ${empleados.length} empleados creados\n`);

  // ============================================
  // 4. CATEGORIAS
  // ============================================
  console.log('Creando categorias...');
  const categoriasData = [
    { nombre: 'Hamburguesas', descripcion: 'Las mejores burgers de la ciudad', orden: 1 },
    { nombre: 'Pizzas', descripcion: 'Pizzas artesanales al horno de barro', orden: 2 },
    { nombre: 'Empanadas', descripcion: 'Empanadas caseras de masa criolla', orden: 3 },
    { nombre: 'Pastas', descripcion: 'Pastas frescas hechas en casa', orden: 4 },
    { nombre: 'Ensaladas', descripcion: 'Ensaladas frescas y saludables', orden: 5 },
    { nombre: 'Entradas', descripcion: 'Para compartir mientras esperan', orden: 6 },
    { nombre: 'Postres', descripcion: 'El dulce final perfecto', orden: 7 },
    { nombre: 'Bebidas', descripcion: 'Refrescos y bebidas', orden: 8 },
    { nombre: 'Cervezas', descripcion: 'Cervezas artesanales e importadas', orden: 9 },
    { nombre: 'Vinos', descripcion: 'Seleccion de vinos argentinos', orden: 10 },
    { nombre: 'Tragos', descripcion: 'Cocktails y tragos', orden: 11 },
    { nombre: 'Menu Infantil', descripcion: 'Especial para los mas chicos', orden: 12 },
  ];

  const categorias = {};
  for (const cat of categoriasData) {
    const categoria = await prisma.categoria.upsert({
      where: { tenantId_nombre: { tenantId: tenant.id, nombre: cat.nombre } },
      update: {},
      create: { tenantId: tenant.id, ...cat, activa: true },
    });
    categorias[cat.nombre] = categoria;
  }
  console.log(`  - ${Object.keys(categorias).length} categorias creadas\n`);

  // ============================================
  // 5. INGREDIENTES
  // ============================================
  console.log('Creando ingredientes...');
  const ingredientesData = [
    { nombre: 'Carne picada', unidad: 'kg', stockActual: 50, stockMinimo: 10, costo: 8500 },
    { nombre: 'Pan de hamburguesa', unidad: 'unidades', stockActual: 200, stockMinimo: 50, costo: 150 },
    { nombre: 'Queso cheddar', unidad: 'kg', stockActual: 15, stockMinimo: 3, costo: 12000 },
    { nombre: 'Queso mozzarella', unidad: 'kg', stockActual: 20, stockMinimo: 5, costo: 10000 },
    { nombre: 'Bacon', unidad: 'kg', stockActual: 10, stockMinimo: 2, costo: 15000 },
    { nombre: 'Lechuga', unidad: 'kg', stockActual: 8, stockMinimo: 2, costo: 2500 },
    { nombre: 'Tomate', unidad: 'kg', stockActual: 12, stockMinimo: 3, costo: 3000 },
    { nombre: 'Cebolla', unidad: 'kg', stockActual: 15, stockMinimo: 3, costo: 1500 },
    { nombre: 'Pepinillos', unidad: 'kg', stockActual: 5, stockMinimo: 1, costo: 4000 },
    { nombre: 'Salsa especial', unidad: 'litros', stockActual: 10, stockMinimo: 2, costo: 5000 },
    { nombre: 'Mayonesa', unidad: 'litros', stockActual: 8, stockMinimo: 2, costo: 3500 },
    { nombre: 'Ketchup', unidad: 'litros', stockActual: 8, stockMinimo: 2, costo: 2500 },
    { nombre: 'Mostaza', unidad: 'litros', stockActual: 5, stockMinimo: 1, costo: 2000 },
    { nombre: 'Papas', unidad: 'kg', stockActual: 30, stockMinimo: 10, costo: 2000 },
    { nombre: 'Aceite', unidad: 'litros', stockActual: 20, stockMinimo: 5, costo: 4000 },
    { nombre: 'Harina 000', unidad: 'kg', stockActual: 50, stockMinimo: 15, costo: 1200 },
    { nombre: 'Levadura', unidad: 'kg', stockActual: 3, stockMinimo: 1, costo: 8000 },
    { nombre: 'Salsa de tomate', unidad: 'litros', stockActual: 15, stockMinimo: 5, costo: 2500 },
    { nombre: 'Oregano', unidad: 'kg', stockActual: 2, stockMinimo: 0.5, costo: 15000 },
    { nombre: 'Jamon cocido', unidad: 'kg', stockActual: 8, stockMinimo: 2, costo: 18000 },
    { nombre: 'Morron', unidad: 'kg', stockActual: 6, stockMinimo: 2, costo: 4000 },
    { nombre: 'Champinones', unidad: 'kg', stockActual: 4, stockMinimo: 1, costo: 12000 },
    { nombre: 'Aceitunas', unidad: 'kg', stockActual: 3, stockMinimo: 1, costo: 8000 },
    { nombre: 'Huevos', unidad: 'unidades', stockActual: 180, stockMinimo: 60, costo: 120 },
    { nombre: 'Coca-Cola', unidad: 'unidades', stockActual: 100, stockMinimo: 30, costo: 800 },
    { nombre: 'Sprite', unidad: 'unidades', stockActual: 60, stockMinimo: 20, costo: 800 },
    { nombre: 'Fanta', unidad: 'unidades', stockActual: 50, stockMinimo: 20, costo: 800 },
    { nombre: 'Agua mineral', unidad: 'unidades', stockActual: 80, stockMinimo: 30, costo: 400 },
    { nombre: 'Cerveza Quilmes', unidad: 'unidades', stockActual: 120, stockMinimo: 40, costo: 1200 },
    { nombre: 'Cerveza Patagonia', unidad: 'unidades', stockActual: 60, stockMinimo: 20, costo: 2500 },
    { nombre: 'Fernet', unidad: 'litros', stockActual: 8, stockMinimo: 2, costo: 12000 },
    { nombre: 'Helado', unidad: 'litros', stockActual: 10, stockMinimo: 3, costo: 8000 },
    { nombre: 'Dulce de leche', unidad: 'kg', stockActual: 5, stockMinimo: 1, costo: 6000 },
    { nombre: 'Chocolate', unidad: 'kg', stockActual: 3, stockMinimo: 1, costo: 12000 },
  ];

  const ingredientes = {};
  for (const ing of ingredientesData) {
    const ingrediente = await prisma.ingrediente.upsert({
      where: { tenantId_nombre: { tenantId: tenant.id, nombre: ing.nombre } },
      update: {},
      create: { tenantId: tenant.id, ...ing, activo: true },
    });
    ingredientes[ing.nombre] = ingrediente;
  }
  console.log(`  - ${Object.keys(ingredientes).length} ingredientes creados\n`);

  // ============================================
  // 6. MODIFICADORES
  // ============================================
  console.log('Creando modificadores...');
  const modificadoresData = [
    // Exclusiones (precio 0)
    { nombre: 'Sin cebolla', precio: 0, tipo: 'EXCLUSION' },
    { nombre: 'Sin tomate', precio: 0, tipo: 'EXCLUSION' },
    { nombre: 'Sin lechuga', precio: 0, tipo: 'EXCLUSION' },
    { nombre: 'Sin mayonesa', precio: 0, tipo: 'EXCLUSION' },
    { nombre: 'Sin pepinillos', precio: 0, tipo: 'EXCLUSION' },
    { nombre: 'Sin salsa', precio: 0, tipo: 'EXCLUSION' },
    { nombre: 'Sin queso', precio: 0, tipo: 'EXCLUSION' },
    { nombre: 'Sin gluten', precio: 0, tipo: 'EXCLUSION' },
    // Adiciones (con precio)
    { nombre: 'Extra queso', precio: 800, tipo: 'ADICION' },
    { nombre: 'Extra bacon', precio: 1200, tipo: 'ADICION' },
    { nombre: 'Extra carne', precio: 2000, tipo: 'ADICION' },
    { nombre: 'Huevo frito', precio: 600, tipo: 'ADICION' },
    { nombre: 'Cebolla caramelizada', precio: 500, tipo: 'ADICION' },
    { nombre: 'Guacamole', precio: 900, tipo: 'ADICION' },
    { nombre: 'Jalapenos', precio: 400, tipo: 'ADICION' },
    { nombre: 'Champinones salteados', precio: 700, tipo: 'ADICION' },
    { nombre: 'Papas fritas', precio: 1500, tipo: 'ADICION' },
    { nombre: 'Aros de cebolla', precio: 1200, tipo: 'ADICION' },
  ];

  const modificadores = {};
  for (const mod of modificadoresData) {
    const modificador = await prisma.modificador.upsert({
      where: { tenantId_nombre: { tenantId: tenant.id, nombre: mod.nombre } },
      update: {},
      create: { tenantId: tenant.id, ...mod, activo: true },
    });
    modificadores[mod.nombre] = modificador;
  }
  console.log(`  - ${Object.keys(modificadores).length} modificadores creados\n`);

  // ============================================
  // 7. PRODUCTOS
  // ============================================
  console.log('Creando productos...');
  const productosData = [
    // Hamburguesas
    { nombre: 'Hamburguesa Clasica', descripcion: 'Carne, lechuga, tomate, cebolla y salsa especial', precio: 5500, categoriaId: categorias['Hamburguesas'].id, destacado: true },
    { nombre: 'Hamburguesa Doble Clasica', descripcion: 'Doble carne, lechuga, tomate, cebolla y salsa especial', precio: 7500, categoriaId: categorias['Hamburguesas'].id },
    { nombre: 'Hamburguesa con Queso', descripcion: 'Carne, queso cheddar, lechuga, tomate', precio: 6000, categoriaId: categorias['Hamburguesas'].id, destacado: true },
    { nombre: 'Hamburguesa Bacon', descripcion: 'Carne, bacon crocante, queso cheddar, cebolla caramelizada', precio: 7000, categoriaId: categorias['Hamburguesas'].id },
    { nombre: 'Hamburguesa BBQ', descripcion: 'Carne, salsa BBQ, bacon, cebolla crispy, queso', precio: 7500, categoriaId: categorias['Hamburguesas'].id },
    { nombre: 'Hamburguesa Mexicana', descripcion: 'Carne, guacamole, jalapenos, nachos, salsa picante', precio: 7200, categoriaId: categorias['Hamburguesas'].id },
    { nombre: 'Hamburguesa Vegetariana', descripcion: 'Medallon de lentejas, lechuga, tomate, hummus', precio: 5800, categoriaId: categorias['Hamburguesas'].id },

    // Pizzas
    { nombre: 'Pizza Muzzarella', descripcion: 'Salsa de tomate, mozzarella, oregano', precio: 6500, categoriaId: categorias['Pizzas'].id, destacado: true },
    { nombre: 'Pizza Napolitana', descripcion: 'Mozzarella, tomate en rodajas, ajo, albahaca', precio: 7000, categoriaId: categorias['Pizzas'].id },
    { nombre: 'Pizza Jamon y Morron', descripcion: 'Mozzarella, jamon cocido, morron asado', precio: 7500, categoriaId: categorias['Pizzas'].id },
    { nombre: 'Pizza Calabresa', descripcion: 'Mozzarella, calabresa, aceitunas', precio: 7800, categoriaId: categorias['Pizzas'].id },
    { nombre: 'Pizza 4 Quesos', descripcion: 'Mozzarella, roquefort, parmesano, provolone', precio: 8500, categoriaId: categorias['Pizzas'].id },
    { nombre: 'Pizza Especial', descripcion: 'Mozzarella, jamon, champinones, huevo, aceitunas', precio: 9000, categoriaId: categorias['Pizzas'].id },
    { nombre: 'Pizza Fugazzeta', descripcion: 'Cebolla caramelizada, mozzarella', precio: 7200, categoriaId: categorias['Pizzas'].id },

    // Empanadas
    { nombre: 'Empanada de Carne', descripcion: 'Carne cortada a cuchillo, cebolla, huevo', precio: 900, categoriaId: categorias['Empanadas'].id },
    { nombre: 'Empanada de Pollo', descripcion: 'Pollo desmenuzado, cebolla, morron', precio: 900, categoriaId: categorias['Empanadas'].id },
    { nombre: 'Empanada Jamon y Queso', descripcion: 'Jamon cocido y queso derretido', precio: 900, categoriaId: categorias['Empanadas'].id },
    { nombre: 'Empanada de Verdura', descripcion: 'Espinaca, cebolla, huevo, salsa blanca', precio: 850, categoriaId: categorias['Empanadas'].id },
    { nombre: 'Empanada Caprese', descripcion: 'Tomate, mozzarella, albahaca', precio: 950, categoriaId: categorias['Empanadas'].id },
    { nombre: 'Docena de Empanadas Surtidas', descripcion: '12 empanadas a eleccion', precio: 9500, categoriaId: categorias['Empanadas'].id, destacado: true },

    // Pastas
    { nombre: 'Ravioles de Ricota', descripcion: 'Ravioles caseros con salsa a eleccion', precio: 7500, categoriaId: categorias['Pastas'].id },
    { nombre: 'Noquis de Papa', descripcion: 'Noquis caseros con salsa a eleccion', precio: 6500, categoriaId: categorias['Pastas'].id },
    { nombre: 'Sorrentinos de Jamon y Queso', descripcion: 'Sorrentinos con salsa rosa', precio: 8000, categoriaId: categorias['Pastas'].id },
    { nombre: 'Tallarines con Tuco', descripcion: 'Tallarines frescos con salsa de tomate casera', precio: 6000, categoriaId: categorias['Pastas'].id },
    { nombre: 'Lasagna Bolognesa', descripcion: 'Lasagna con carne, bechamel y queso gratinado', precio: 8500, categoriaId: categorias['Pastas'].id, destacado: true },

    // Ensaladas
    { nombre: 'Ensalada Caesar', descripcion: 'Lechuga, pollo grillado, croutons, parmesano, aderezo caesar', precio: 5500, categoriaId: categorias['Ensaladas'].id },
    { nombre: 'Ensalada Mixta', descripcion: 'Lechuga, tomate, cebolla, zanahoria', precio: 3500, categoriaId: categorias['Ensaladas'].id },
    { nombre: 'Ensalada Caprese', descripcion: 'Tomate, mozzarella fresca, albahaca, oliva', precio: 5000, categoriaId: categorias['Ensaladas'].id },
    { nombre: 'Ensalada Griega', descripcion: 'Pepino, tomate, cebolla, aceitunas, queso feta', precio: 5200, categoriaId: categorias['Ensaladas'].id },

    // Entradas
    { nombre: 'Papas Fritas', descripcion: 'Papas fritas crocantes con salsa a eleccion', precio: 3500, categoriaId: categorias['Entradas'].id },
    { nombre: 'Papas con Cheddar y Bacon', descripcion: 'Papas fritas con cheddar derretido y bacon', precio: 5000, categoriaId: categorias['Entradas'].id, destacado: true },
    { nombre: 'Aros de Cebolla', descripcion: 'Aros de cebolla rebozados con dip', precio: 3800, categoriaId: categorias['Entradas'].id },
    { nombre: 'Nachos con Guacamole', descripcion: 'Nachos con guacamole, crema y pico de gallo', precio: 4500, categoriaId: categorias['Entradas'].id },
    { nombre: 'Provoleta', descripcion: 'Provolone a la parrilla con oregano y tomate', precio: 4200, categoriaId: categorias['Entradas'].id },
    { nombre: 'Tabla de Fiambres', descripcion: 'Jamon crudo, salame, queso, aceitunas, pan', precio: 7500, categoriaId: categorias['Entradas'].id },

    // Postres
    { nombre: 'Flan Casero', descripcion: 'Flan con dulce de leche y crema', precio: 3500, categoriaId: categorias['Postres'].id },
    { nombre: 'Brownie con Helado', descripcion: 'Brownie tibio con helado de vainilla y chocolate', precio: 4500, categoriaId: categorias['Postres'].id, destacado: true },
    { nombre: 'Cheesecake', descripcion: 'Cheesecake de frutos rojos', precio: 4200, categoriaId: categorias['Postres'].id },
    { nombre: 'Tiramisu', descripcion: 'Tiramisu tradicional italiano', precio: 4500, categoriaId: categorias['Postres'].id },
    { nombre: 'Helado (3 bochas)', descripcion: 'Helado artesanal a eleccion', precio: 3800, categoriaId: categorias['Postres'].id },
    { nombre: 'Panqueques con Dulce de Leche', descripcion: 'Panqueques con dulce de leche y crema', precio: 3500, categoriaId: categorias['Postres'].id },

    // Bebidas
    { nombre: 'Coca-Cola 500ml', descripcion: 'Coca-Cola linea regular o zero', precio: 2000, categoriaId: categorias['Bebidas'].id },
    { nombre: 'Sprite 500ml', descripcion: 'Sprite', precio: 2000, categoriaId: categorias['Bebidas'].id },
    { nombre: 'Fanta 500ml', descripcion: 'Fanta naranja', precio: 2000, categoriaId: categorias['Bebidas'].id },
    { nombre: 'Agua Mineral 500ml', descripcion: 'Con o sin gas', precio: 1500, categoriaId: categorias['Bebidas'].id },
    { nombre: 'Agua Saborizada', descripcion: 'Varios sabores', precio: 1800, categoriaId: categorias['Bebidas'].id },
    { nombre: 'Jugo de Naranja', descripcion: 'Jugo exprimido', precio: 2500, categoriaId: categorias['Bebidas'].id },
    { nombre: 'Limonada', descripcion: 'Limonada casera', precio: 2200, categoriaId: categorias['Bebidas'].id },
    { nombre: 'Cafe', descripcion: 'Cafe espresso', precio: 1500, categoriaId: categorias['Bebidas'].id },
    { nombre: 'Cafe con Leche', descripcion: 'Cafe con leche', precio: 1800, categoriaId: categorias['Bebidas'].id },
    { nombre: 'Cortado', descripcion: 'Cortado', precio: 1600, categoriaId: categorias['Bebidas'].id },

    // Cervezas
    { nombre: 'Quilmes 500ml', descripcion: 'Cerveza Quilmes', precio: 2500, categoriaId: categorias['Cervezas'].id },
    { nombre: 'Stella Artois 500ml', descripcion: 'Cerveza Stella Artois', precio: 3000, categoriaId: categorias['Cervezas'].id },
    { nombre: 'Patagonia Amber Lager', descripcion: 'Cerveza Patagonia', precio: 3500, categoriaId: categorias['Cervezas'].id },
    { nombre: 'Corona 330ml', descripcion: 'Cerveza Corona', precio: 3200, categoriaId: categorias['Cervezas'].id },
    { nombre: 'Heineken 330ml', descripcion: 'Cerveza Heineken', precio: 3200, categoriaId: categorias['Cervezas'].id },
    { nombre: 'IPA Artesanal', descripcion: 'Cerveza artesanal IPA', precio: 4000, categoriaId: categorias['Cervezas'].id },

    // Vinos
    { nombre: 'Vino Tinto Copa', descripcion: 'Vino tinto de la casa', precio: 2500, categoriaId: categorias['Vinos'].id },
    { nombre: 'Vino Blanco Copa', descripcion: 'Vino blanco de la casa', precio: 2500, categoriaId: categorias['Vinos'].id },
    { nombre: 'Malbec Botella', descripcion: 'Malbec mendocino', precio: 8500, categoriaId: categorias['Vinos'].id },
    { nombre: 'Cabernet Sauvignon Botella', descripcion: 'Cabernet Sauvignon', precio: 9000, categoriaId: categorias['Vinos'].id },
    { nombre: 'Torrontes Botella', descripcion: 'Torrontes salteno', precio: 7500, categoriaId: categorias['Vinos'].id },

    // Tragos
    { nombre: 'Fernet con Coca', descripcion: 'Fernet Branca con Coca-Cola', precio: 4000, categoriaId: categorias['Tragos'].id },
    { nombre: 'Gin Tonic', descripcion: 'Gin con agua tonica y pepino', precio: 5000, categoriaId: categorias['Tragos'].id },
    { nombre: 'Mojito', descripcion: 'Ron, menta, limon, azucar', precio: 4800, categoriaId: categorias['Tragos'].id },
    { nombre: 'Daiquiri', descripcion: 'Ron, limon, azucar', precio: 4500, categoriaId: categorias['Tragos'].id },
    { nombre: 'Aperol Spritz', descripcion: 'Aperol, prosecco, soda', precio: 5200, categoriaId: categorias['Tragos'].id },
    { nombre: 'Negroni', descripcion: 'Gin, campari, vermut', precio: 5500, categoriaId: categorias['Tragos'].id },

    // Menu Infantil
    { nombre: 'Mini Hamburguesa', descripcion: 'Hamburguesa pequena con papas', precio: 4500, categoriaId: categorias['Menu Infantil'].id },
    { nombre: 'Nuggets de Pollo', descripcion: '6 nuggets con papas fritas', precio: 4000, categoriaId: categorias['Menu Infantil'].id },
    { nombre: 'Milanesa con Pure', descripcion: 'Milanesa de pollo con pure', precio: 4200, categoriaId: categorias['Menu Infantil'].id },
    { nombre: 'Fideos con Manteca', descripcion: 'Fideos con manteca y queso', precio: 3500, categoriaId: categorias['Menu Infantil'].id },
  ];

  const productos = {};

  // Check if products already exist for this tenant
  const existingProducts = await prisma.producto.findMany({
    where: { tenantId: tenant.id },
  });

  if (existingProducts.length > 0) {
    console.log(`  - Ya existen ${existingProducts.length} productos, reutilizando...`);
    for (const prod of existingProducts) {
      productos[prod.nombre] = prod;
    }
  } else {
    for (const prod of productosData) {
      const producto = await prisma.producto.create({
        data: {
          tenantId: tenant.id,
          ...prod,
          disponible: true,
        },
      });
      productos[prod.nombre] = producto;
    }
  }
  console.log(`  - ${Object.keys(productos).length} productos creados\n`);

  // ============================================
  // 8. PRODUCTO-MODIFICADORES
  // ============================================
  console.log('Asignando modificadores a productos...');
  const hamburguesas = Object.entries(productos)
    .filter(([nombre]) => nombre.includes('Hamburguesa'))
    .map(([, prod]) => prod);

  let modCount = 0;
  for (const burger of hamburguesas) {
    for (const mod of Object.values(modificadores)) {
      await prisma.productoModificador.upsert({
        where: {
          tenantId_productoId_modificadorId: {
            tenantId: tenant.id,
            productoId: burger.id,
            modificadorId: mod.id,
          },
        },
        update: {},
        create: {
          tenantId: tenant.id,
          productoId: burger.id,
          modificadorId: mod.id,
        },
      });
      modCount++;
    }
  }
  console.log(`  - ${modCount} relaciones producto-modificador procesadas\n`);

  // ============================================
  // 9. MESAS
  // ============================================
  console.log('Creando mesas...');
  const mesasData = [
    { numero: 1, zona: 'Salon Principal', capacidad: 4, estado: 'LIBRE' },
    { numero: 2, zona: 'Salon Principal', capacidad: 4, estado: 'LIBRE' },
    { numero: 3, zona: 'Salon Principal', capacidad: 6, estado: 'LIBRE' },
    { numero: 4, zona: 'Salon Principal', capacidad: 2, estado: 'LIBRE' },
    { numero: 5, zona: 'Salon Principal', capacidad: 4, estado: 'LIBRE' },
    { numero: 6, zona: 'Terraza', capacidad: 4, estado: 'LIBRE' },
    { numero: 7, zona: 'Terraza', capacidad: 4, estado: 'LIBRE' },
    { numero: 8, zona: 'Terraza', capacidad: 6, estado: 'LIBRE' },
    { numero: 9, zona: 'Terraza', capacidad: 8, estado: 'LIBRE' },
    { numero: 10, zona: 'VIP', capacidad: 6, estado: 'LIBRE' },
    { numero: 11, zona: 'VIP', capacidad: 8, estado: 'LIBRE' },
    { numero: 12, zona: 'VIP', capacidad: 10, estado: 'LIBRE' },
    { numero: 13, zona: 'Barra', capacidad: 2, estado: 'LIBRE' },
    { numero: 14, zona: 'Barra', capacidad: 2, estado: 'LIBRE' },
    { numero: 15, zona: 'Barra', capacidad: 2, estado: 'LIBRE' },
  ];

  const mesas = {};
  for (const mesa of mesasData) {
    const m = await prisma.mesa.upsert({
      where: { tenantId_numero: { tenantId: tenant.id, numero: mesa.numero } },
      update: {},
      create: { tenantId: tenant.id, ...mesa, activa: true },
    });
    mesas[mesa.numero] = m;
  }
  console.log(`  - ${Object.keys(mesas).length} mesas creadas\n`);

  // ============================================
  // 10. RESERVAS
  // ============================================
  console.log('Creando reservas...');
  const hoy = new Date();
  const manana = new Date(hoy);
  manana.setDate(hoy.getDate() + 1);
  const pasadoManana = new Date(hoy);
  pasadoManana.setDate(hoy.getDate() + 2);

  const reservasData = [
    { mesaId: mesas[10].id, clienteNombre: 'Roberto Sanchez', clienteTelefono: '1155551111', fechaHora: new Date(manana.setHours(20, 0, 0, 0)), cantidadPersonas: 4, estado: 'CONFIRMADA' },
    { mesaId: mesas[11].id, clienteNombre: 'Familia Martinez', clienteTelefono: '1155552222', fechaHora: new Date(manana.setHours(21, 0, 0, 0)), cantidadPersonas: 6, estado: 'CONFIRMADA' },
    { mesaId: mesas[12].id, clienteNombre: 'Cumpleanos Lucia', clienteTelefono: '1155553333', fechaHora: new Date(pasadoManana.setHours(20, 30, 0, 0)), cantidadPersonas: 10, estado: 'CONFIRMADA', observaciones: 'Traen torta. Preparar velas.' },
    { mesaId: mesas[6].id, clienteNombre: 'Juan Perez', clienteTelefono: '1155554444', fechaHora: new Date(manana.setHours(13, 0, 0, 0)), cantidadPersonas: 2, estado: 'CONFIRMADA' },
    { mesaId: mesas[3].id, clienteNombre: 'Ana Rodriguez', clienteTelefono: '1155555555', fechaHora: new Date(pasadoManana.setHours(21, 30, 0, 0)), cantidadPersonas: 5, estado: 'CONFIRMADA' },
  ];

  for (const reserva of reservasData) {
    await prisma.reserva.create({
      data: { tenantId: tenant.id, ...reserva },
    });
  }
  console.log(`  - ${reservasData.length} reservas creadas\n`);

  // ============================================
  // 11. PEDIDOS DE EJEMPLO
  // ============================================
  console.log('Creando pedidos de ejemplo...');
  const admin = usuarios[0];
  const mozo = usuarios[1];

  // Pedido 1: Mesa con estado PENDIENTE
  const pedido1 = await prisma.pedido.create({
    data: {
      tenantId: tenant.id,
      tipo: 'MESA',
      estado: 'PENDIENTE',
      mesaId: mesas[1].id,
      usuarioId: mozo.id,
      subtotal: 13000,
      total: 13000,
      origen: 'INTERNO',
    },
  });
  await prisma.pedidoItem.createMany({
    data: [
      { tenantId: tenant.id, pedidoId: pedido1.id, productoId: productos['Hamburguesa Clasica'].id, cantidad: 2, precioUnitario: 5500, subtotal: 11000 },
      { tenantId: tenant.id, pedidoId: pedido1.id, productoId: productos['Coca-Cola 500ml'].id, cantidad: 1, precioUnitario: 2000, subtotal: 2000 },
    ],
  });
  await prisma.mesa.update({ where: { id: mesas[1].id }, data: { estado: 'OCUPADA' } });

  // Pedido 2: Mesa en preparacion
  const pedido2 = await prisma.pedido.create({
    data: {
      tenantId: tenant.id,
      tipo: 'MESA',
      estado: 'EN_PREPARACION',
      mesaId: mesas[3].id,
      usuarioId: mozo.id,
      subtotal: 22500,
      total: 22500,
      origen: 'INTERNO',
    },
  });
  await prisma.pedidoItem.createMany({
    data: [
      { tenantId: tenant.id, pedidoId: pedido2.id, productoId: productos['Pizza Especial'].id, cantidad: 1, precioUnitario: 9000, subtotal: 9000 },
      { tenantId: tenant.id, pedidoId: pedido2.id, productoId: productos['Pizza Muzzarella'].id, cantidad: 1, precioUnitario: 6500, subtotal: 6500 },
      { tenantId: tenant.id, pedidoId: pedido2.id, productoId: productos['Quilmes 500ml'].id, cantidad: 2, precioUnitario: 2500, subtotal: 5000 },
      { tenantId: tenant.id, pedidoId: pedido2.id, productoId: productos['Agua Mineral 500ml'].id, cantidad: 1, precioUnitario: 1500, subtotal: 1500 },
    ],
  });
  await prisma.mesa.update({ where: { id: mesas[3].id }, data: { estado: 'OCUPADA' } });

  // Pedido 3: Delivery pendiente
  const pedido3 = await prisma.pedido.create({
    data: {
      tenantId: tenant.id,
      tipo: 'DELIVERY',
      estado: 'PENDIENTE',
      clienteNombre: 'Martin Gonzalez',
      clienteTelefono: '1155559999',
      clienteDireccion: 'Av. Santa Fe 2500, Piso 4, Depto B',
      tipoEntrega: 'DELIVERY',
      costoEnvio: 500,
      subtotal: 15000,
      total: 15500,
      origen: 'MENU_PUBLICO',
    },
  });
  await prisma.pedidoItem.createMany({
    data: [
      { tenantId: tenant.id, pedidoId: pedido3.id, productoId: productos['Hamburguesa BBQ'].id, cantidad: 2, precioUnitario: 7500, subtotal: 15000 },
    ],
  });

  // Pedido 4: Mostrador listo para retirar
  const pedido4 = await prisma.pedido.create({
    data: {
      tenantId: tenant.id,
      tipo: 'MOSTRADOR',
      estado: 'LISTO',
      clienteNombre: 'Cliente Mostrador',
      subtotal: 9500,
      total: 9500,
      origen: 'INTERNO',
      usuarioId: admin.id,
    },
  });
  await prisma.pedidoItem.createMany({
    data: [
      { tenantId: tenant.id, pedidoId: pedido4.id, productoId: productos['Docena de Empanadas Surtidas'].id, cantidad: 1, precioUnitario: 9500, subtotal: 9500 },
    ],
  });

  // Pedido 5: Cobrado (con pago registrado)
  const pedido5 = await prisma.pedido.create({
    data: {
      tenantId: tenant.id,
      tipo: 'MESA',
      estado: 'COBRADO',
      mesaId: mesas[5].id,
      usuarioId: mozo.id,
      subtotal: 18000,
      total: 18000,
      estadoPago: 'APROBADO',
      origen: 'INTERNO',
    },
  });
  await prisma.pedidoItem.createMany({
    data: [
      { tenantId: tenant.id, pedidoId: pedido5.id, productoId: productos['Lasagna Bolognesa'].id, cantidad: 2, precioUnitario: 8500, subtotal: 17000 },
      { tenantId: tenant.id, pedidoId: pedido5.id, productoId: productos['Agua Mineral 500ml'].id, cantidad: 1, precioUnitario: 1500, subtotal: 1500 },
    ],
  });
  await prisma.pago.create({
    data: {
      tenantId: tenant.id,
      pedidoId: pedido5.id,
      monto: 18000,
      metodo: 'EFECTIVO',
      estado: 'APROBADO',
      montoAbonado: 20000,
      vuelto: 2000,
    },
  });

  console.log(`  - 5 pedidos de ejemplo creados\n`);

  // ============================================
  // 12. FICHAJES
  // ============================================
  console.log('Creando fichajes de ejemplo...');
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);

  for (const emp of empleados.slice(0, 4)) {
    // Fichaje de ayer (completo)
    await prisma.fichaje.create({
      data: {
        tenantId: tenant.id,
        empleadoId: emp.id,
        fecha: ayer,
        entrada: new Date(ayer.setHours(9, 0, 0, 0)),
        salida: new Date(ayer.setHours(17, 0, 0, 0)),
      },
    });
    // Fichaje de hoy (entrada)
    await prisma.fichaje.create({
      data: {
        tenantId: tenant.id,
        empleadoId: emp.id,
        fecha: hoy,
        entrada: new Date(hoy.setHours(9, 0, 0, 0)),
      },
    });
  }
  console.log(`  - Fichajes creados para ${empleados.slice(0, 4).length} empleados\n`);

  // ============================================
  // 13. CIERRE DE CAJA
  // ============================================
  console.log('Creando cierre de caja de ejemplo...');
  await prisma.cierreCaja.create({
    data: {
      tenantId: tenant.id,
      usuarioId: admin.id,
      fecha: ayer,
      horaApertura: new Date(ayer.setHours(10, 0, 0, 0)),
      horaCierre: new Date(ayer.setHours(23, 0, 0, 0)),
      fondoInicial: 10000,
      totalEfectivo: 85000,
      totalTarjeta: 45000,
      totalMP: 32000,
      efectivoFisico: 95500,
      diferencia: 500,
      estado: 'CERRADO',
      observaciones: 'Cierre normal. Diferencia minima.',
    },
  });
  console.log(`  - 1 cierre de caja creado\n`);

  // ============================================
  // 14. CONFIGURACION
  // ============================================
  console.log('Creando configuraciones...');
  const configs = [
    { clave: 'COSTO_ENVIO_DEFAULT', valor: '500' },
    { clave: 'RADIO_DELIVERY_KM', valor: '5' },
    { clave: 'HORARIO_APERTURA', valor: '11:00' },
    { clave: 'HORARIO_CIERRE', valor: '00:00' },
    { clave: 'TELEFONO_CONTACTO', valor: '+54 11 1234-5678' },
    { clave: 'EMAIL_CONTACTO', valor: 'contacto@restaurantedemo.com' },
    { clave: 'DIRECCION', valor: 'Av. Corrientes 1234, CABA' },
    { clave: 'MOSTRAR_PRECIOS_MENU_PUBLICO', valor: 'true' },
    { clave: 'PERMITIR_PEDIDOS_ONLINE', valor: 'true' },
    { clave: 'TIEMPO_ESTIMADO_COCINA', valor: '30' },
    { clave: 'TIEMPO_ESTIMADO_DELIVERY', valor: '45' },
  ];

  for (const config of configs) {
    await prisma.configuracion.upsert({
      where: { tenantId_clave: { tenantId: tenant.id, clave: config.clave } },
      update: {},
      create: { tenantId: tenant.id, ...config },
    });
  }
  console.log(`  - ${configs.length} configuraciones creadas\n`);

  // ============================================
  // RESUMEN
  // ============================================
  console.log('=' .repeat(50));
  console.log('SEED COMPLETO FINALIZADO');
  console.log('=' .repeat(50));
  console.log(`
Credenciales de acceso:
  Tenant: restaurante-demo

  Admin:    admin@demo.com / demo123
  Mozo 1:   mozo1@demo.com / demo123
  Mozo 2:   mozo2@demo.com / demo123
  Cocinero: cocinero@demo.com / demo123
  Cajero:   cajero@demo.com / demo123
  Delivery: delivery@demo.com / demo123

Datos creados:
  - 1 tenant (PRO)
  - 6 usuarios
  - 6 empleados
  - 12 categorias
  - ${Object.keys(productos).length} productos
  - 18 modificadores
  - ${Object.keys(ingredientes).length} ingredientes
  - 15 mesas (4 zonas)
  - 5 reservas
  - 5 pedidos de ejemplo
  - Fichajes y cierre de caja
  - Configuraciones del sistema
`);
}

main()
  .catch((e) => {
    console.error('Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
