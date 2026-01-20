# Plan: Multi-Tenancy for GestioNeo

**Generated**: 2026-01-20
**Estimated Complexity**: High

## Overview
Migrate GestioNeo to a single-database, tenant-scoped SaaS model using tenantId on every row, slug-based public URLs, JWT tenant claims for authenticated routes, and Supabase RLS for defense in depth. This plan covers schema updates, backend tenant scoping, onboarding, super admin, frontend routing/branding, RLS policies, and safe data migration. In scope: backend + frontend + DB + RLS. Out of scope: multi-DB deployment or per-tenant infrastructure.

## Prerequisites
- Backup the current PostgreSQL database before any migration.
- Choose a default tenant slug for existing data (e.g., "gestioneo" or "default").
- Ensure SMTP credentials exist for verification emails (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM).
- Access to Supabase SQL editor to apply RLS policies.
- Identify the initial Super Admin account and how it will be created (seed or manual insert).

## Phase 1: Database Schema Changes
### Task 1.1: Create Tenant model
- **Location**: backend/prisma/schema.prisma
- **Description**: Add the Tenant model, branding fields, and plan enum. Wire relations from Tenant to all tenant-owned models.
- **Dependencies**: None
- **Complexity**: 6
- **Test-First Approach**: Add a schema validation test (or CI step) to run `npx prisma validate`. Add a unit test to create a Tenant and verify slug uniqueness.
- **Acceptance Criteria**: Prisma schema validates; Tenant can be created; slug is unique; plan defaults to FREE; activo defaults to false.
- **Schema Snippet**:
```prisma
enum PlanTenant {
  FREE
  PRO
  ENTERPRISE
}

model Tenant {
  id              Int        @id @default(autoincrement())
  slug            String     @unique
  nombre          String
  email           String
  telefono        String?
  direccion       String?
  logo            String?
  bannerUrl       String?
  colorPrimario   String?
  colorSecundario String?
  plan            PlanTenant @default(FREE)
  activo          Boolean    @default(false)
  createdAt       DateTime   @default(now())

  usuarios        Usuario[]
  empleados       Empleado[]
  mesas           Mesa[]
  categorias      Categoria[]
  productos       Producto[]
  ingredientes    Ingrediente[]
  pedidos         Pedido[]
  pagos           Pago[]
  fichajes        Fichaje[]
  liquidaciones   Liquidacion[]
  movimientos     MovimientoStock[]
  reservas        Reserva[]
  cierres         CierreCaja[]
  printJobs       PrintJob[]
  modificadores   Modificador[]
  configuraciones Configuracion[]

  @@map("tenants")
}
```

### Task 1.2: Add tenantId to core domain tables
- **Location**: backend/prisma/schema.prisma
- **Description**: Add `tenantId` and Tenant relations to Usuario, Empleado, Mesa, Categoria, Producto, Ingrediente, Pedido, PedidoItem, Pago, Fichaje, Liquidacion, MovimientoStock, Reserva, CierreCaja, PrintJob, Modificador, ProductoIngrediente, ProductoModificador, PedidoItemModificador.
- **Dependencies**: Task 1.1
- **Complexity**: 8
- **Test-First Approach**: Add unit tests that create data in two tenants and verify isolation using tenant-scoped queries.
- **Acceptance Criteria**: All listed models include `tenantId` + relation to Tenant; Prisma migration compiles; queries can filter by tenantId.
- **Schema Snippet (example)**:
```prisma
model Usuario {
  id        Int      @id @default(autoincrement())
  tenantId  Int
  email     String
  password  String
  nombre    String
  rol       Rol      @default(MOZO)
  activo    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  pedidos   Pedido[]
  cierres   CierreCaja[]

  @@unique([tenantId, email])
  @@index([tenantId])
  @@map("usuarios")
}

model Mesa {
  id        Int        @id @default(autoincrement())
  tenantId  Int
  numero    Int
  zona      String?
  capacidad Int        @default(4)
  estado    EstadoMesa @default(LIBRE)
  activa    Boolean    @default(true)
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  tenant    Tenant     @relation(fields: [tenantId], references: [id])
  pedidos   Pedido[]
  reservas  Reserva[]

  @@unique([tenantId, numero])
  @@index([tenantId])
  @@map("mesas")
}
```

### Task 1.3: Add tenantId to join tables and adjust composite uniques
- **Location**: backend/prisma/schema.prisma
- **Description**: Add tenantId to ProductoIngrediente, ProductoModificador, PedidoItemModificador; update unique constraints to include tenantId.
- **Dependencies**: Task 1.2
- **Complexity**: 5
- **Test-First Approach**: Add unit tests that create the same productoId/modificadorId pairs in two tenants without conflicts.
- **Acceptance Criteria**: Join tables include tenantId and composite uniques that allow duplicates across tenants.
- **Schema Snippet (example)**:
```prisma
model ProductoIngrediente {
  id            Int     @id @default(autoincrement())
  tenantId      Int
  productoId    Int
  ingredienteId Int
  cantidad      Decimal @db.Decimal(10, 3)

  tenant        Tenant     @relation(fields: [tenantId], references: [id])
  producto      Producto   @relation(fields: [productoId], references: [id], onDelete: Cascade)
  ingrediente   Ingrediente @relation(fields: [ingredienteId], references: [id])

  @@unique([tenantId, productoId, ingredienteId])
  @@index([tenantId])
  @@map("producto_ingredientes")
}
```

### Task 1.4: Make Configuracion tenant-scoped
- **Location**: backend/prisma/schema.prisma
- **Description**: Add tenantId to Configuracion and change unique constraint to be per-tenant. Update any defaults to use Tenant context.
- **Dependencies**: Task 1.1
- **Complexity**: 4
- **Test-First Approach**: Add unit tests to store same clave in two tenants without conflict.
- **Acceptance Criteria**: Configuracion includes tenantId and `@@unique([tenantId, clave])`.
- **Schema Snippet**:
```prisma
model Configuracion {
  id        Int      @id @default(autoincrement())
  tenantId  Int
  clave     String
  valor     String
  updatedAt DateTime @updatedAt

  tenant    Tenant   @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, clave])
  @@index([tenantId])
  @@map("configuraciones")
}
```

### Task 1.5: Add email verification model
- **Location**: backend/prisma/schema.prisma
- **Description**: Add a model to store verification tokens for tenant onboarding and mark usuarios as verified.
- **Dependencies**: Task 1.1
- **Complexity**: 4
- **Test-First Approach**: Add a unit test to create token, verify expiration, and mark usedAt.
- **Acceptance Criteria**: Tokens are unique; verification can be marked used; linked to tenant and usuario.
- **Schema Snippet**:
```prisma
model EmailVerificacion {
  id        Int      @id @default(autoincrement())
  tenantId  Int
  usuarioId Int
  token     String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  usuario   Usuario  @relation(fields: [usuarioId], references: [id])

  @@index([tenantId, usuarioId])
  @@map("email_verificaciones")
}
```

## Phase 2: Backend Multi-Tenancy Middleware
### Task 2.1: Centralize Prisma client and add tenant-aware helper
- **Location**: backend/src/db/prisma.js (new), update imports across backend
- **Description**: Create a shared Prisma client and a helper to scope queries by tenantId; replace all `new PrismaClient()` usages in controllers/services/jobs.
- **Dependencies**: Phase 1
- **Complexity**: 7
- **Test-First Approach**: Add unit tests for the tenant helper to ensure it injects tenantId on create/find/update.
- **Acceptance Criteria**: No files instantiate PrismaClient directly; all queries go through the shared helper; tenantId auto-injected where appropriate.
- **Middleware Snippet**:
```js
// backend/src/db/prisma.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getTenantPrisma = (tenantId, isSuperAdmin = false) => {
  if (isSuperAdmin) return prisma;

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
          if (!args) args = {};

          if (['findMany', 'findFirst', 'count', 'aggregate', 'groupBy'].includes(operation)) {
            args.where = { ...(args.where || {}), tenantId };
          }

          if (['update', 'delete', 'upsert'].includes(operation)) {
            args.where = { ...(args.where || {}), tenantId };
          }

          if (['create', 'createMany'].includes(operation)) {
            args.data = Array.isArray(args.data)
              ? args.data.map(d => ({ ...d, tenantId }))
              : { ...(args.data || {}), tenantId };
          }

          return query(args);
        }
      }
    }
  });
};

module.exports = { prisma, getTenantPrisma };
```

### Task 2.2: Add tenant context middleware
- **Location**: backend/src/middlewares/tenant.middleware.js (new), backend/src/app.js
- **Description**: Resolve tenantId from JWT for authenticated routes and from slug for public routes. Attach `req.tenantId`, `req.tenantSlug`, and `req.prisma`.
- **Dependencies**: Task 2.1
- **Complexity**: 6
- **Test-First Approach**: Add unit tests for slug resolution and 404 for inactive tenant.
- **Acceptance Criteria**: All routes receive tenant context; public routes resolve tenant by slug; inactive tenants are blocked.
- **Middleware Snippet**:
```js
const { prisma, getTenantPrisma } = require('../db/prisma');

const resolveTenantFromSlug = async (req, res, next) => {
  const { slug } = req.params;
  if (!slug) return res.status(400).json({ error: { message: 'Slug requerido' } });

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant || !tenant.activo) {
    return res.status(404).json({ error: { message: 'Restaurante no encontrado o inactivo' } });
  }

  req.tenantId = tenant.id;
  req.tenantSlug = tenant.slug;
  req.prisma = getTenantPrisma(tenant.id, req.isSuperAdmin);
  return next();
};

module.exports = { resolveTenantFromSlug };
```

### Task 2.3: Update auth middleware to include tenant context
- **Location**: backend/src/middlewares/auth.middleware.js
- **Description**: Decode tenantId from JWT, validate tenant + usuario are active, and set `req.tenantId` and `req.isSuperAdmin`.
- **Dependencies**: Task 2.2
- **Complexity**: 5
- **Test-First Approach**: Add unit tests to reject tokens with mismatched tenantId and inactive tenant.
- **Acceptance Criteria**: Authenticated requests always have tenantId; super admin is detected; inactive users or tenants are rejected.

### Task 2.4: Wire tenant middleware in app.js
- **Location**: backend/src/app.js
- **Description**: Mount tenant middleware for public routes (slug based) and ensure authenticated routes set tenant context before controllers run.
- **Dependencies**: Task 2.2, Task 2.3
- **Complexity**: 4
- **Test-First Approach**: Add integration test that calls `/api/publico/:slug/menu` and verifies tenant scoping.
- **Acceptance Criteria**: All API routes that touch data have tenant context; missing tenant context returns a clear error.

## Phase 3: API Route Updates
### Task 3.1: Update login to require tenant context
- **Location**: backend/src/controllers/auth.controller.js, backend/src/routes/auth.routes.js
- **Description**: Require slug (or tenant selection) during login, load user by tenantId + email, and include tenantId/tenantSlug in JWT claims and response.
- **Dependencies**: Phase 2
- **Complexity**: 6
- **Test-First Approach**: Add integration test for login with correct slug; verify cross-tenant login fails.
- **Acceptance Criteria**: Login requires slug; JWT includes `tenant_id`; user search scoped to tenant.

### Task 3.2: Update public routes to be slug-based
- **Location**: backend/src/routes/publico.routes.js, backend/src/controllers/configuracion.controller.js
- **Description**: Change public endpoints to `/api/publico/:slug/config`, `/api/publico/:slug/menu`, `/api/publico/:slug/pedido`, `/api/publico/:slug/pedido/:id/pagar` and scope all queries by tenantId.
- **Dependencies**: Task 2.2
- **Complexity**: 7
- **Test-First Approach**: Add integration tests for public menu + pedido creation with two tenants.
- **Acceptance Criteria**: Public menu and config are tenant-specific; orders created via public menu carry tenantId.

### Task 3.3: Scope all controllers to tenantId
- **Location**: backend/src/controllers/*.controller.js (auth, categorias, cierres, configuracion, empleados, fichajes, impresion, ingredientes, liquidaciones, mesas, modificadores, pagos, pedidos, productos, reportes, reservas)
- **Description**: Replace direct PrismaClient usage with `req.prisma` and ensure every query includes tenantId via middleware or explicit where clauses. Update any `findUnique` usage to `findFirst` with tenantId when needed.
- **Dependencies**: Task 2.1
- **Complexity**: 9
- **Test-First Approach**: For each controller, add a test that attempts cross-tenant access and expects 404/403.
- **Acceptance Criteria**: All controller queries are tenant-scoped; no cross-tenant data is returned or modified.

### Task 3.4: Scope services, jobs, and events to tenant
- **Location**: backend/src/services/email.service.js, backend/src/services/print.service.js, backend/src/services/event-bus.js, backend/src/routes/eventos.routes.js, backend/src/jobs/reservas.job.js
- **Description**: Include tenantId in event payloads, filter SSE by tenant, and ensure background jobs iterate by tenant. Update email and print queries to include tenantId.
- **Dependencies**: Task 2.1, Task 2.3
- **Complexity**: 7
- **Test-First Approach**: Add tests to confirm SSE does not leak events across tenants.
- **Acceptance Criteria**: Events and background jobs are tenant-isolated; services only query within tenantId.

## Phase 4: Tenant Registration & Onboarding
### Task 4.1: Add registration endpoint to create Tenant + Admin usuario
- **Location**: backend/src/routes/registro.routes.js (new), backend/src/controllers/registro.controller.js (new)
- **Description**: Implement `/api/registro` to create Tenant and first admin user in a transaction, set tenant.activo=false, usuario.activo=false, and create EmailVerificacion token.
- **Dependencies**: Phase 1, Phase 2
- **Complexity**: 7
- **Test-First Approach**: Add integration test to ensure tenant + admin user are created atomically.
- **Acceptance Criteria**: Transaction succeeds or rolls back; slug is unique; admin user is created for new tenant.

### Task 4.2: Implement email verification flow
- **Location**: backend/src/controllers/registro.controller.js, backend/src/services/email.service.js, backend/src/routes/registro.routes.js
- **Description**: Send verification email with a secure token; create `/api/registro/verificar` to activate tenant + usuario and mark token used.
- **Dependencies**: Task 4.1
- **Complexity**: 6
- **Test-First Approach**: Add test for token expiration and verify activation only once.
- **Acceptance Criteria**: Email verification activates tenant and admin user; expired or reused tokens are rejected.

### Task 4.3: Add rate limiting and slug validation
- **Location**: backend/src/routes/registro.routes.js, backend/src/utils/slug.js (new)
- **Description**: Add rate limit to /registro and a slug normalizer/validator to prevent collisions and unsafe slugs.
- **Dependencies**: Task 4.1
- **Complexity**: 4
- **Test-First Approach**: Add unit tests for slug validation and collision detection.
- **Acceptance Criteria**: Invalid slugs are rejected; registration is rate-limited.

### Task 4.4: Build public registration page
- **Location**: frontend/src/pages/Registro.jsx (new), frontend/src/App.jsx
- **Description**: Create `/registro` page with Spanish UI text, form validation, and success state instructing email verification.
- **Dependencies**: Task 4.1
- **Complexity**: 5
- **Test-First Approach**: Add frontend tests to validate form errors and successful submission.
- **Acceptance Criteria**: Registration page submits data, shows errors in Espanol, and displays verification instructions.

## Phase 5: Super Admin Panel
### Task 5.1: Add SUPER_ADMIN role and bootstrap account
- **Location**: backend/prisma/schema.prisma, backend/prisma/seed.js
- **Description**: Extend Rol enum with SUPER_ADMIN and seed a super admin user (assign to a system tenant or dedicated tenant).
- **Dependencies**: Phase 1
- **Complexity**: 5
- **Test-First Approach**: Add unit test to verify SUPER_ADMIN role bypass logic.
- **Acceptance Criteria**: SUPER_ADMIN can authenticate; role is stored in JWT; tenant scoping can be bypassed safely.

### Task 5.2: Add super admin API endpoints
- **Location**: backend/src/routes/superadmin.routes.js (new), backend/src/controllers/superadmin.controller.js (new)
- **Description**: Implement endpoints to list tenants, activate/deactivate, and fetch basic metrics (orders count, revenue, active users) by tenant.
- **Dependencies**: Task 5.1
- **Complexity**: 6
- **Test-First Approach**: Add integration tests for /super-admin endpoints to ensure access control.
- **Acceptance Criteria**: Super admin can list and toggle tenant status; metrics are returned per tenant.

### Task 5.3: Add super admin frontend route
- **Location**: frontend/src/pages/superadmin/SuperAdmin.jsx (new), frontend/src/App.jsx, frontend/src/components/RedirectByRole.jsx
- **Description**: Create `/super-admin` UI with tenant list, status toggles, and metrics summary; protect route to SUPER_ADMIN only.
- **Dependencies**: Task 5.2
- **Complexity**: 6
- **Test-First Approach**: Add frontend tests to ensure non-super-admin users are redirected.
- **Acceptance Criteria**: Super admin UI loads data, toggles tenant status, and is hidden for tenant admins.

## Phase 6: Frontend Updates
### Task 6.1: Update public menu routing to use slug
- **Location**: frontend/src/App.jsx, frontend/src/pages/MenuPublico.jsx
- **Description**: Change route to `/menu/:slug` and update all public API calls to include slug in the path.
- **Dependencies**: Task 3.2
- **Complexity**: 5
- **Test-First Approach**: Add frontend tests verifying menu loads with slug and errors when slug is invalid.
- **Acceptance Criteria**: Public menu works only with slug; public config and menu are tenant-specific.

### Task 6.2: Add tenant context and branding loader
- **Location**: frontend/src/context/TenantContext.jsx (new), frontend/src/main.jsx
- **Description**: Add a TenantContext to load branding and tenant info; store tenantSlug in localStorage for reuse in login.
- **Dependencies**: Task 3.2
- **Complexity**: 6
- **Test-First Approach**: Add unit tests for TenantContext state transitions (loading, success, error).
- **Acceptance Criteria**: Branding is available across public pages and admin layout; tenantSlug persists.

### Task 6.3: Update login to include tenant context
- **Location**: frontend/src/pages/Login.jsx, frontend/src/context/AuthContext.jsx
- **Description**: Add slug input (or tenant selector) to login form and send slug in `/auth/login`. Store tenant info from response.
- **Dependencies**: Task 3.1, Task 6.2
- **Complexity**: 5
- **Test-First Approach**: Add frontend test to ensure login requires slug and shows errors in Espanol.
- **Acceptance Criteria**: Login includes tenant slug; user state includes tenantId/tenantSlug.

### Task 6.4: Apply tenant branding to layouts
- **Location**: frontend/src/components/layouts/PublicLayout.jsx, frontend/src/components/layouts/AdminLayout.jsx, frontend/src/index.css
- **Description**: Apply tenant logo, banner, and colors via CSS variables; keep UI text in Espanol.
- **Dependencies**: Task 6.2
- **Complexity**: 6
- **Test-First Approach**: Add UI tests to check CSS variables are set after branding load.
- **Acceptance Criteria**: Public and admin layouts reflect tenant branding without breaking layout on mobile.

### Task 6.5: Update tenant context usage in API and events
- **Location**: frontend/src/services/api.js, frontend/src/services/eventos.js
- **Description**: Include tenantSlug in headers or query params where needed, and include token + tenant context for SSE.
- **Dependencies**: Task 6.2
- **Complexity**: 4
- **Test-First Approach**: Add tests for EventSource URL generation with tenant context.
- **Acceptance Criteria**: API calls and SSE connections carry tenant context; no cross-tenant updates are shown.

## Phase 7: Supabase RLS Policies
### Task 7.1: Enable RLS on all tenant tables
- **Location**: Supabase SQL editor; store scripts in docs/rls.sql
- **Description**: Enable RLS for all tenant-owned tables and add base policies for tenant isolation.
- **Dependencies**: Phase 1
- **Complexity**: 6
- **Test-First Approach**: Create SQL tests to verify a tenant JWT cannot read other tenant rows.
- **Acceptance Criteria**: RLS is enabled and policies exist for every tenant table.
- **Policy Snippet**:
```sql
alter table usuarios enable row level security;

create policy tenant_isolation_usuarios
on usuarios
for all
using ((auth.jwt() ->> 'tenant_id') = ("tenantId")::text)
with check ((auth.jwt() ->> 'tenant_id') = ("tenantId")::text);
```

### Task 7.2: Add super admin bypass policy
- **Location**: Supabase SQL editor; docs/rls.sql
- **Description**: Allow SUPER_ADMIN to bypass tenant isolation via JWT claim.
- **Dependencies**: Task 7.1
- **Complexity**: 3
- **Test-First Approach**: Add SQL tests to verify SUPER_ADMIN can read all tenants.
- **Acceptance Criteria**: SUPER_ADMIN can read/write across tenants; regular users cannot.
- **Policy Snippet**:
```sql
create policy super_admin_bypass_usuarios
on usuarios
for all
using ((auth.jwt() ->> 'role') = 'SUPER_ADMIN')
with check ((auth.jwt() ->> 'role') = 'SUPER_ADMIN');
```

### Task 7.3: Set JWT claims per request for Prisma connections
- **Location**: backend/src/db/prisma.js
- **Description**: For each request, execute `set_config('request.jwt.claims', ...)` inside a transaction so `auth.jwt()` works for RLS. Use tenantId and role claims.
- **Dependencies**: Task 2.1
- **Complexity**: 7
- **Test-First Approach**: Add integration test that uses RLS and verifies access denied without correct tenant claim.
- **Acceptance Criteria**: RLS policies enforce tenant isolation for Prisma queries.

## Phase 8: Data Migration
### Task 8.1: Create staged migrations for tenantId
- **Location**: backend/prisma/migrations/*
- **Description**: Use multiple migrations: (1) create Tenant + EmailVerificacion, (2) add tenantId nullable to all tables with defaults, (3) backfill tenantId for existing data, (4) change tenantId to NOT NULL and update uniques.
- **Dependencies**: Phase 1
- **Complexity**: 8
- **Test-First Approach**: Run migration on a copy of production data and verify row counts match.
- **Acceptance Criteria**: Migration completes without data loss; all rows have tenantId.

### Task 8.2: Create default tenant and backfill existing data
- **Location**: backend/prisma/seed.js, backend/prisma/migrations/*
- **Description**: Insert the default tenant, update all existing rows to reference it, and update seed data to include tenantId.
- **Dependencies**: Task 8.1
- **Complexity**: 6
- **Test-First Approach**: Add a seed test to verify all created records have tenantId.
- **Acceptance Criteria**: All existing data belongs to the default tenant; seed creates tenant-scoped records.

### Task 8.3: Backward compatibility for public menu
- **Location**: backend/src/routes/publico.routes.js, frontend/src/App.jsx
- **Description**: Keep `/menu` and `/api/publico/menu` as temporary redirects to the default slug during a transition window; emit deprecation warnings in logs.
- **Dependencies**: Task 3.2, Task 6.1
- **Complexity**: 4
- **Test-First Approach**: Add tests to verify `/menu` redirects to `/menu/:defaultSlug`.
- **Acceptance Criteria**: Legacy routes still work for the default tenant and log a warning.

## Testing Strategy
- **Unit Tests**: Add tests for slug validation, tenant middleware, and Prisma tenant scoping (backend/src/__tests__). Run `npm test` in backend.
- **Integration Tests**: Add tests for login with tenant slug, public menu access, and cross-tenant access denial using supertest.
- **E2E Tests**: Add UI tests in frontend/src/__tests__ for public menu + login + onboarding flows using Vitest and Testing Library (`npm test` in frontend).

## Dependency Graph
- Phase 1 (schema) -> Phase 8 (migrations/backfill) -> Phase 2 (tenant middleware) -> Phase 3 (route updates)
- Phase 3 -> Phase 4 (onboarding) -> Phase 6 (frontend changes)
- Phase 5 (super admin) depends on Phase 1 + Phase 2
- Phase 7 (RLS) depends on Phase 1 + Phase 2

## Potential Risks
- Cross-tenant data leakage if any query bypasses tenant scoping.
- Migration downtime or lock contention when adding tenantId to large tables.
- JWT claim mismatch with RLS, causing unexpected access denial.
- Slug collisions or changes breaking existing public URLs.
- SSE/event streams leaking events across tenants if not filtered.

## Rollback Plan
- Restore database from backup taken before Phase 8 migrations.
- Revert backend and frontend to pre-multi-tenant routes (keep /menu and /login).
- Disable RLS policies in Supabase if they block access unexpectedly.
- Roll back to single-tenant seed data and remove tenant middleware usage.
