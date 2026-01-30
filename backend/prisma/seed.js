require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed de la base de datos...');

  const tenantSlug = process.env.SEED_TENANT_SLUG || 'default';
  const tenantNombre = process.env.SEED_TENANT_NOMBRE || 'Comanda Demo';
  const tenantEmail = process.env.SEED_TENANT_EMAIL || 'admin@comanda.app';

  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: { nombre: tenantNombre, email: tenantEmail, activo: true },
    create: { slug: tenantSlug, nombre: tenantNombre, email: tenantEmail, activo: true }
  });

  const tenantId = tenant.id;

  // Crear usuario admin
  const passwordHash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.usuario.upsert({
    where: { tenantId_email: { tenantId, email: 'admin@comanda.app' } },
    update: {},
    create: {
      tenantId,
      email: 'admin@comanda.app',
      password: passwordHash,
      nombre: 'Administrador',
      rol: 'ADMIN'
    }
  });
  console.log('Usuario admin creado:', admin.email);

  // Crear usuario mozo de prueba
  const mozo = await prisma.usuario.upsert({
    where: { tenantId_email: { tenantId, email: 'mozo@comanda.app' } },
    update: {},
    create: {
      tenantId,
      email: 'mozo@comanda.app',
      password: await bcrypt.hash('mozo123', 10),
      nombre: 'Juan Mozo',
      rol: 'MOZO'
    }
  });
  console.log('Usuario mozo creado:', mozo.email);

  // Crear usuario cocinero de prueba
  const cocinero = await prisma.usuario.upsert({
    where: { tenantId_email: { tenantId, email: 'cocinero@comanda.app' } },
    update: {},
    create: {
      tenantId,
      email: 'cocinero@comanda.app',
      password: await bcrypt.hash('cocinero123', 10),
      nombre: 'Pedro Cocinero',
      rol: 'COCINERO'
    }
  });
  console.log('Usuario cocinero creado:', cocinero.email);

  // Crear empleados
  const empleados = [
    { nombre: 'Juan', apellido: 'Pérez', dni: '30123456', telefono: '1155551234', rol: 'MOZO', tarifaHora: 1500 },
    { nombre: 'María', apellido: 'García', dni: '31234567', telefono: '1155552345', rol: 'MOZO', tarifaHora: 1500 },
    { nombre: 'Pedro', apellido: 'López', dni: '32345678', telefono: '1155553456', rol: 'COCINERO', tarifaHora: 1800 },
    { nombre: 'Ana', apellido: 'Martínez', dni: '33456789', telefono: '1155554567', rol: 'COCINERO', tarifaHora: 1800 }
  ];

  for (const emp of empleados) {
    await prisma.empleado.upsert({
      where: { tenantId_dni: { tenantId, dni: emp.dni } },
      update: {},
      create: { tenantId, ...emp }
    });
  }
  console.log('Empleados creados:', empleados.length);

  // Crear mesas
  const mesas = [
    { numero: 1, zona: 'Interior', capacidad: 4 },
    { numero: 2, zona: 'Interior', capacidad: 4 },
    { numero: 3, zona: 'Interior', capacidad: 6 },
    { numero: 4, zona: 'Interior', capacidad: 2 },
    { numero: 5, zona: 'Terraza', capacidad: 4 },
    { numero: 6, zona: 'Terraza', capacidad: 4 },
    { numero: 7, zona: 'Terraza', capacidad: 6 },
    { numero: 8, zona: 'Barra', capacidad: 2 }
  ];

  for (const mesa of mesas) {
    await prisma.mesa.upsert({
      where: { tenantId_numero: { tenantId, numero: mesa.numero } },
      update: {},
      create: { tenantId, ...mesa }
    });
  }
  console.log('Mesas creadas:', mesas.length);

  // Crear categorías
  const categorias = [
    { nombre: 'Hamburguesas', descripcion: 'Nuestras deliciosas hamburguesas', orden: 1 },
    { nombre: 'Papas y Acompañamientos', descripcion: 'Papas fritas y más', orden: 2 },
    { nombre: 'Bebidas', descripcion: 'Gaseosas, jugos y más', orden: 3 },
    { nombre: 'Postres', descripcion: 'Para los golosos', orden: 4 },
    { nombre: 'Combos', descripcion: 'Las mejores combinaciones', orden: 5 }
  ];

  const categoriasCreadas = {};
  for (const cat of categorias) {
    const created = await prisma.categoria.upsert({
      where: { tenantId_nombre: { tenantId, nombre: cat.nombre } },
      update: {},
      create: { tenantId, ...cat }
    });
    categoriasCreadas[cat.nombre] = created.id;
  }
  console.log('Categorías creadas:', categorias.length);

  // Crear ingredientes
  const ingredientes = [
    { nombre: 'Carne de hamburguesa', unidad: 'unidades', stockActual: 100, stockMinimo: 20, costo: 800 },
    { nombre: 'Pan de hamburguesa', unidad: 'unidades', stockActual: 150, stockMinimo: 30, costo: 200 },
    { nombre: 'Queso cheddar', unidad: 'fetas', stockActual: 200, stockMinimo: 50, costo: 100 },
    { nombre: 'Bacon', unidad: 'fetas', stockActual: 100, stockMinimo: 25, costo: 150 },
    { nombre: 'Lechuga', unidad: 'hojas', stockActual: 80, stockMinimo: 20, costo: 30 },
    { nombre: 'Tomate', unidad: 'rodajas', stockActual: 100, stockMinimo: 30, costo: 50 },
    { nombre: 'Cebolla', unidad: 'aros', stockActual: 80, stockMinimo: 20, costo: 30 },
    { nombre: 'Papas', unidad: 'kg', stockActual: 30, stockMinimo: 10, costo: 500 },
    { nombre: 'Coca-Cola', unidad: 'unidades', stockActual: 48, stockMinimo: 12, costo: 400 },
    { nombre: 'Sprite', unidad: 'unidades', stockActual: 24, stockMinimo: 12, costo: 400 },
    { nombre: 'Agua mineral', unidad: 'unidades', stockActual: 36, stockMinimo: 12, costo: 200 }
  ];

  const ingredientesCreados = {};
  for (const ing of ingredientes) {
    const created = await prisma.ingrediente.upsert({
      where: { tenantId_nombre: { tenantId, nombre: ing.nombre } },
      update: {},
      create: { tenantId, ...ing }
    });
    ingredientesCreados[ing.nombre] = created.id;
  }
  console.log('Ingredientes creados:', ingredientes.length);

  // Crear productos
  const productos = [
    {
      nombre: 'Hamburguesa Clásica',
      descripcion: 'Carne, lechuga, tomate, cebolla y mayonesa',
      precio: 4500,
      categoriaId: categoriasCreadas['Hamburguesas'],
      destacado: true
    },
    {
      nombre: 'Hamburguesa con Queso',
      descripcion: 'Carne, queso cheddar, lechuga, tomate y mayonesa',
      precio: 5000,
      categoriaId: categoriasCreadas['Hamburguesas'],
      destacado: true
    },
    {
      nombre: 'Hamburguesa Doble',
      descripcion: 'Doble carne, doble queso, bacon, lechuga y salsa especial',
      precio: 6500,
      categoriaId: categoriasCreadas['Hamburguesas'],
      destacado: true
    },
    {
      nombre: 'Hamburguesa Bacon',
      descripcion: 'Carne, bacon crocante, queso, cebolla caramelizada',
      precio: 5500,
      categoriaId: categoriasCreadas['Hamburguesas']
    },
    {
      nombre: 'Papas Fritas',
      descripcion: 'Porción de papas fritas crocantes',
      precio: 1800,
      categoriaId: categoriasCreadas['Papas y Acompañamientos']
    },
    {
      nombre: 'Papas con Cheddar',
      descripcion: 'Papas fritas con salsa cheddar y bacon',
      precio: 2500,
      categoriaId: categoriasCreadas['Papas y Acompañamientos']
    },
    {
      nombre: 'Aros de Cebolla',
      descripcion: 'Porción de aros de cebolla rebozados',
      precio: 2000,
      categoriaId: categoriasCreadas['Papas y Acompañamientos']
    },
    {
      nombre: 'Coca-Cola 500ml',
      descripcion: 'Gaseosa Coca-Cola',
      precio: 1200,
      categoriaId: categoriasCreadas['Bebidas']
    },
    {
      nombre: 'Sprite 500ml',
      descripcion: 'Gaseosa Sprite',
      precio: 1200,
      categoriaId: categoriasCreadas['Bebidas']
    },
    {
      nombre: 'Agua Mineral 500ml',
      descripcion: 'Agua mineral sin gas',
      precio: 800,
      categoriaId: categoriasCreadas['Bebidas']
    },
    {
      nombre: 'Brownie con Helado',
      descripcion: 'Brownie de chocolate con helado de vainilla',
      precio: 2500,
      categoriaId: categoriasCreadas['Postres']
    },
    {
      nombre: 'Combo Clásico',
      descripcion: 'Hamburguesa clásica + Papas + Gaseosa',
      precio: 6800,
      categoriaId: categoriasCreadas['Combos'],
      destacado: true
    },
    {
      nombre: 'Combo Doble',
      descripcion: 'Hamburguesa doble + Papas con cheddar + Gaseosa',
      precio: 9500,
      categoriaId: categoriasCreadas['Combos'],
      destacado: true
    }
  ];

  for (const prod of productos) {
    const existente = await prisma.producto.findFirst({
      where: { tenantId, nombre: prod.nombre }
    });

    if (existente) {
      await prisma.producto.update({
        where: { id: existente.id },
        data: prod
      });
      continue;
    }

    await prisma.producto.create({
      data: { tenantId, ...prod }
    });
  }
  console.log('Productos creados:', productos.length);

  // Configuraciones iniciales
  const configs = [
    { clave: 'nombre_local', valor: 'Comanda Demo' },
    { clave: 'direccion', valor: 'Av. Principal 123' },
    { clave: 'telefono', valor: '11-5555-0000' },
    { clave: 'moneda', valor: 'ARS' }
  ];

  for (const config of configs) {
    await prisma.configuracion.upsert({
      where: { tenantId_clave: { tenantId, clave: config.clave } },
      update: { valor: config.valor },
      create: { tenantId, ...config }
    });
  }
  console.log('Configuraciones creadas:', configs.length);

  console.log('\n✅ Seed completado exitosamente!');
  console.log('\nUsuarios de prueba:');
  console.log('  Admin: admin@comanda.app / admin123');
  console.log('  Mozo: mozo@comanda.app / mozo123');
  console.log('  Cocinero: cocinero@comanda.app / cocinero123');
}

main()
  .catch((e) => {
    console.error('Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
