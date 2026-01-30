# Guía para Desarrolladores - Comanda

Esta guía está diseñada para ayudar a desarrolladores junior a entender la arquitectura, patrones y convenciones del proyecto.

## Arquitectura General

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React 19)                   │
│                   http://localhost:5173                  │
│                                                         │
│  pages/ ─→ components/ ─→ hooks/ ─→ services/api.js    │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼ (HTTP + JWT)
┌─────────────────────────────────────────────────────────┐
│                    BACKEND (Express 5)                   │
│                   http://localhost:3001                  │
│                                                         │
│  routes/ ─→ middlewares/ ─→ controllers/ ─→ services/  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼ (Prisma ORM)
┌─────────────────────────────────────────────────────────┐
│                      PostgreSQL                          │
└─────────────────────────────────────────────────────────┘
```

## Tecnologías Principales

| Capa | Tecnología | Versión | Propósito |
|------|------------|---------|-----------|
| Frontend | React | 19 | UI Library |
| Frontend | Vite | 7 | Build tool |
| Frontend | Tailwind CSS | 4 | Estilos |
| Backend | Express | 5 | Framework HTTP |
| Backend | Prisma | 5 | ORM |
| Backend | Zod | 3 | Validación |
| Base de datos | PostgreSQL | 14+ | RDBMS |
| Testing | Playwright | 1.58 | E2E |
| Testing | Jest/Vitest | - | Unit tests |

---

## Flujo de una Request Típica

### Ejemplo: Listar productos

```
[Frontend]                    [Backend]                      [Base de datos]
     │                            │                                │
     │ GET /api/productos         │                                │
     │ Authorization: Bearer xxx  │                                │
     ├───────────────────────────►│                                │
     │                            │                                │
     │                       verificarToken()                      │
     │                       ¿Token válido?                        │
     │                            │                                │
     │                       verificarRol()                        │
     │                       ¿Rol permitido?                       │
     │                            │                                │
     │                       setTenantFromAuth()                   │
     │                       req.prisma = getTenantPrisma()        │
     │                            │                                │
     │                       controller.listar()                   │
     │                            │                                │
     │                       service.listar(prisma)                │
     │                            ├──────────────────────────────►│
     │                            │  SELECT * FROM productos       │
     │                            │  WHERE tenantId = X            │
     │                            │◄──────────────────────────────┤
     │                            │                                │
     │◄───────────────────────────┤                                │
     │ 200 OK + JSON              │                                │
```

### Código correspondiente

**1. Frontend hace la request:**
```javascript
// services/api.js - El interceptor agrega el token automáticamente
const { data } = useAsync(async ({ signal }) => {
  const response = await api.get('/productos', { signal });
  return response.data;
});
```

**2. Ruta recibe la request:**
```javascript
// routes/productos.routes.js
router.get('/',
  verificarToken,           // 1. Verifica JWT
  verificarRol('ADMIN', 'MOZO'), // 2. Verifica rol
  setTenantFromAuth,        // 3. Configura tenant
  controller.listar         // 4. Ejecuta lógica
);
```

**3. Controller llama al service:**
```javascript
// controllers/productos.controller.js
const listar = async (req, res) => {
  const prisma = req.prisma; // Ya tiene scoping de tenant
  const productos = await productosService.listar(prisma, req.query);
  res.json(productos);
};
```

**4. Service ejecuta la lógica:**
```javascript
// services/productos.service.js
const listar = async (prisma, query) => {
  // prisma ya tiene filtro de tenantId automático
  return prisma.producto.findMany({
    where: { categoriaId: query.categoriaId },
    include: { categoria: true }
  });
};
```

---

## Multi-Tenancy

Comanda soporta múltiples restaurantes (tenants) en la misma instancia. Cada tenant tiene sus datos completamente aislados.

### Cómo funciona

1. **El usuario pertenece a un tenant**: Cada usuario tiene un `tenantId` que indica a qué restaurante pertenece.

2. **El token JWT incluye el tenantId**: Cuando el usuario hace login, el token contiene su `tenantId`.

3. **Prisma filtra automáticamente**: El middleware `setTenantFromAuth` crea un cliente Prisma que automáticamente agrega `WHERE tenantId = X` a todas las queries.

```javascript
// Esto es lo que hace el middleware internamente
const getTenantPrisma = (tenantId) => {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          // Agrega tenantId a WHERE automáticamente
          args.where = { ...args.where, tenantId };
          return query(args);
        }
      }
    }
  });
};
```

### En la práctica

**Backend - No necesitas hacer nada especial:**
```javascript
// El filtro de tenant ya está aplicado
const productos = await prisma.producto.findMany();
// Esto solo retorna productos del tenant del usuario
```

**Frontend - No necesitas hacer nada especial:**
```javascript
// El token ya incluye tenantId
const { data } = await api.get('/productos');
// Solo recibes productos de tu restaurante
```

### Modelos con tenant scoping

Estos modelos se filtran automáticamente por tenant:
- usuario, empleado, producto, categoria, ingrediente
- modificador, mesa, pedido, pedidoItem, pago
- reserva, cierreCaja, fichaje, liquidacion
- configuracion, printJob, movimientoStock

---

## Autenticación y Roles

### Roles disponibles

| Rol | Descripción | Acceso |
|-----|-------------|--------|
| `SUPER_ADMIN` | Administrador global | Todo (sin filtro de tenant) |
| `ADMIN` | Administrador del restaurante | Dashboard, reportes, configuración |
| `MOZO` | Camarero | Mesas, pedidos |
| `COCINERO` | Cocina | Ver pedidos en preparación |
| `CAJERO` | Caja | Cobrar pedidos |
| `DELIVERY` | Repartidor | Pedidos de delivery |

### Cómo proteger una ruta

```javascript
// Solo admin
router.get('/reportes', verificarToken, verificarRol('ADMIN'), controller.get);

// Admin o mozo
router.post('/pedidos', verificarToken, verificarRol('ADMIN', 'MOZO'), controller.create);

// Cualquier usuario autenticado
router.get('/perfil', verificarToken, controller.getPerfil);
```

### En el frontend

```jsx
import { useAuth } from '../context/AuthContext';

function MiComponente() {
  const { usuario, esAdmin, esMozo } = useAuth();

  return (
    <div>
      <span>Hola, {usuario?.nombre}</span>

      {/* Solo visible para admin */}
      {esAdmin && <Link to="/reportes">Reportes</Link>}

      {/* Visible para admin y mozo */}
      {(esAdmin || esMozo) && <Link to="/mesas">Mesas</Link>}
    </div>
  );
}
```

---

## Validación con Zod

El backend usa Zod para validar datos de entrada. Los schemas están en `backend/src/schemas/`.

### Estructura de un schema

```javascript
// schemas/productos.schemas.js
const z = require('zod');

const crearProductoSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(100),
  precio: z.coerce.number().positive('El precio debe ser mayor a 0'),
  categoriaId: z.coerce.number().int().positive(),
  disponible: z.boolean().optional().default(true)
});

module.exports = { crearProductoSchema };
```

### Uso en rutas

```javascript
// routes/productos.routes.js
const validate = require('../middlewares/validate.middleware');
const { crearProductoSchema } = require('../schemas/productos.schemas');

router.post('/',
  verificarToken,
  verificarRol('ADMIN'),
  validate({ body: crearProductoSchema }), // Valida antes de llegar al controller
  controller.crear
);
```

### Qué pasa si falla la validación

El middleware retorna automáticamente un error 400:
```json
{
  "error": {
    "message": "Datos inválidos",
    "details": [
      { "path": ["nombre"], "message": "El nombre es requerido" },
      { "path": ["precio"], "message": "El precio debe ser mayor a 0" }
    ]
  }
}
```

---

## Custom Hooks del Frontend

### useAsync - Operaciones asíncronas

El hook más usado del proyecto. Maneja loading, error y data automáticamente.

```jsx
// Cargar datos al montar el componente
const { data: productos, loading, error } = useAsync(
  async ({ signal }) => {
    const response = await api.get('/productos', { signal });
    return response.data;
  }
);

if (loading) return <Spinner />;
if (error) return <p>Error: {error.message}</p>;
return <Lista items={productos} />;
```

```jsx
// Ejecutar manualmente (ej: submit de form)
const { execute: guardar, loading } = useAsync(
  async ({ signal }, datos) => {
    await api.post('/productos', datos, { signal });
  },
  {
    immediate: false, // No ejecutar al montar
    onSuccess: () => toast.success('Guardado!')
  }
);

const handleSubmit = () => guardar(formData);
```

### useEventSource - Eventos en tiempo real (SSE)

Para recibir actualizaciones en tiempo real (nuevos pedidos, cambios de estado, etc).

```jsx
const { connected } = useEventSource('/api/eventos/1', {
  'pedido.created': (data) => {
    setPedidos(prev => [...prev, data]);
    playSound();
  },
  'pedido.updated': (data) => {
    setPedidos(prev => prev.map(p =>
      p.id === data.id ? { ...p, ...data } : p
    ));
  }
});

// Mostrar indicador de conexión
<span className={connected ? 'text-green-500' : 'text-red-500'}>
  {connected ? '● Conectado' : '○ Desconectado'}
</span>
```

### usePolling - Polling con intervalo

Para consultas periódicas cuando SSE no es viable.

```jsx
usePolling(
  async () => {
    const response = await api.get('/pedidos/pendientes');
    setPedidos(response.data);
  },
  5000, // Cada 5 segundos
  { enabled: true }
);
```

---

## Convenciones de Código

### Nombres de archivos

| Tipo | Convención | Ejemplo |
|------|------------|---------|
| Componentes React | `PascalCase.jsx` | `Productos.jsx` |
| Hooks | `useCamelCase.js` | `useAsync.js` |
| Services | `camelCase.service.js` | `productos.service.js` |
| Controllers | `camelCase.controller.js` | `productos.controller.js` |
| Schemas | `camelCase.schemas.js` | `productos.schemas.js` |
| Tests | `NombreArchivo.test.js` | `Productos.test.jsx` |

### Nombres de variables

| Tipo | Convención | Ejemplo |
|------|------------|---------|
| Variables | `camelCase` | `isLoading`, `pedidoActual` |
| Constantes | `UPPER_SNAKE_CASE` | `API_URL`, `MAX_ITEMS` |
| Componentes | `PascalCase` | `ProductoCard`, `LoginForm` |
| Clases CSS | `kebab-case` | `btn-primary`, `card-header` |

### Estructura de componentes React

```jsx
// 1. Imports (externos primero, luego internos)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

// 2. Componente
export default function MiComponente({ prop1, prop2 }) {
  // 3. Hooks (siempre al principio)
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [estado, setEstado] = useState(null);
  const [loading, setLoading] = useState(false);

  // 4. Effects
  useEffect(() => {
    cargarDatos();
  }, []);

  // 5. Funciones auxiliares
  const cargarDatos = async () => {
    setLoading(true);
    try {
      const response = await api.get('/datos');
      setEstado(response.data);
    } finally {
      setLoading(false);
    }
  };

  // 6. Handlers
  const handleClick = () => {
    // ...
  };

  // 7. Render condicional (early return)
  if (loading) return <Spinner />;
  if (!estado) return <p>Sin datos</p>;

  // 8. Return principal
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

---

## Patrones Comunes

### Cargar datos al montar

```jsx
const { data, loading, error, execute: recargar } = useAsync(
  async ({ signal }) => {
    const response = await api.get('/endpoint', { signal });
    return response.data;
  }
);

// Recargar después de una acción
const handleDelete = async (id) => {
  await api.delete(`/endpoint/${id}`);
  recargar(); // Recarga la lista
};
```

### Submit de formulario

```jsx
const [form, setForm] = useState({ nombre: '', precio: '' });

const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    await api.post('/productos', form);
    toast.success('Producto creado');
    cerrarModal();
    recargarLista();
  } catch (error) {
    // El interceptor de api.js ya muestra el toast de error
    console.error('Error adicional:', error);
  }
};
```

### Modal con estado

```jsx
const [showModal, setShowModal] = useState(false);
const [editando, setEditando] = useState(null);

const abrirParaCrear = () => {
  setEditando(null);
  setShowModal(true);
};

const abrirParaEditar = (item) => {
  setEditando(item);
  setShowModal(true);
};

const cerrarModal = () => {
  setEditando(null);
  setShowModal(false);
};
```

---

## Testing

### Backend (Jest)

```bash
cd backend
npm test                    # Todos los tests
npm test -- --watch        # Watch mode
npm test pedidos           # Tests que contengan "pedidos"
npm test -- --coverage     # Con cobertura
```

### Frontend (Vitest)

```bash
cd frontend
npm test                    # Todos los tests
npm run test:ui            # Con UI de Vitest
npm test -- --watch        # Watch mode
```

### E2E (Playwright)

```bash
cd e2e
npm test                   # Headless
npm run test:headed        # Con navegador visible
npm run test:debug         # Modo debug
```

---

## Comandos Útiles

### Desarrollo

```bash
# Backend
cd backend
npm run dev                 # Servidor con hot-reload

# Frontend
cd frontend
npm run dev                 # Vite dev server

# Base de datos
cd backend
npm run db:migrate          # Aplicar migraciones
npm run db:seed            # Cargar datos de prueba
npm run db:reset           # Resetear BD completamente
npm run db:studio          # Abrir Prisma Studio (GUI)
```

### Linting y Formato

```bash
# En cualquier carpeta (backend/frontend)
npm run lint               # Ver errores de linting
npm run lint:fix           # Corregir automáticamente
npm run format             # Formatear con Prettier
```

---

## Estructura de Carpetas

### Backend

```
backend/
├── src/
│   ├── controllers/       # Lógica de endpoints
│   ├── services/          # Lógica de negocio
│   ├── routes/            # Definición de rutas
│   ├── middlewares/       # Auth, validación, tenant
│   ├── schemas/           # Validación con Zod
│   ├── utils/             # Utilidades (HttpError, etc)
│   ├── db/                # Configuración Prisma
│   ├── jobs/              # Tareas programadas
│   └── __tests__/         # Tests
├── prisma/
│   ├── schema.prisma      # Modelos de BD
│   ├── migrations/        # Migraciones
│   └── seed*.js           # Scripts de seed
└── uploads/               # Imágenes subidas
```

### Frontend

```
frontend/
├── src/
│   ├── pages/             # Páginas/vistas
│   │   ├── admin/         # Páginas de admin
│   │   ├── mozo/          # Páginas de mozo
│   │   ├── cocina/        # Pantalla de cocina
│   │   └── delivery/      # Páginas de delivery
│   ├── components/        # Componentes reutilizables
│   │   ├── layouts/       # Layouts (AdminLayout, etc)
│   │   └── ui/            # Componentes UI básicos
│   ├── hooks/             # Custom hooks
│   ├── context/           # Context API (AuthContext)
│   ├── services/          # API client
│   └── __tests__/         # Tests
└── public/                # Assets estáticos
```

---

## Recursos Adicionales

- [Documentación de React 19](https://react.dev/)
- [Documentación de Prisma](https://www.prisma.io/docs)
- [Documentación de Tailwind CSS](https://tailwindcss.com/docs)
- [Documentación de Zod](https://zod.dev/)
- [Documentación de Express](https://expressjs.com/)
- [Documentación de Playwright](https://playwright.dev/)

---

## Preguntas Frecuentes

### ¿Por qué no veo los datos de otros restaurantes?

Por el multi-tenancy. Cada usuario solo ve los datos de su propio tenant (restaurante). Esto es automático y no requiere código adicional.

### ¿Cómo agrego un nuevo endpoint?

1. Crear schema de validación en `schemas/`
2. Crear función en `services/`
3. Crear función en `controllers/`
4. Agregar ruta en `routes/`
5. Registrar ruta en `app.js`

### ¿Cómo agrego una nueva página?

1. Crear componente en `pages/`
2. Agregar ruta en `App.jsx`
3. Proteger con `<ProtectedRoute>` si es necesario

### ¿Por qué mis cambios no se guardan en la BD?

1. Verifica que la migración esté aplicada (`npm run db:migrate`)
2. Revisa la consola del backend por errores
3. Usa Prisma Studio (`npm run db:studio`) para inspeccionar

### ¿Cómo debuggeo un error del backend?

1. Revisa la consola del servidor
2. El error tiene `status`, `message` y posiblemente `details`
3. Usa `console.log` temporalmente para ver valores
4. Los errores de Prisma se mapean automáticamente a HTTP
