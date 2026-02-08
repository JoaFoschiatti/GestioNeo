export const ROLE = Object.freeze({
  ADMIN: 'ADMIN',
  MOZO: 'MOZO',
  COCINERO: 'COCINERO',
  CAJERO: 'CAJERO',
  DELIVERY: 'DELIVERY'
})

export const ROUTE_ACCESS = Object.freeze({
  dashboard: [ROLE.ADMIN, ROLE.COCINERO, ROLE.CAJERO],
  empleados: [ROLE.ADMIN],
  mesas: [ROLE.ADMIN, ROLE.MOZO],
  categorias: [ROLE.ADMIN],
  productos: [ROLE.ADMIN],
  ingredientes: [ROLE.ADMIN],
  liquidaciones: [ROLE.ADMIN],
  reportes: [ROLE.ADMIN, ROLE.CAJERO],
  configuracion: [ROLE.ADMIN],
  cierreCaja: [ROLE.ADMIN, ROLE.CAJERO],
  reservas: [ROLE.ADMIN],
  modificadores: [ROLE.ADMIN],
  transaccionesMp: [ROLE.ADMIN],
  transferencias: [ROLE.ADMIN, ROLE.CAJERO],
  suscripcion: [ROLE.ADMIN],
  pedidos: [ROLE.ADMIN, ROLE.MOZO, ROLE.CAJERO],
  mozoNuevoPedido: [ROLE.ADMIN, ROLE.MOZO],
  cocina: [ROLE.ADMIN, ROLE.COCINERO],
  deliveryPedidos: [ROLE.ADMIN, ROLE.DELIVERY]
})

export const CAPABILITY_ACCESS = Object.freeze({
  createManualOrder: [ROLE.ADMIN, ROLE.CAJERO],
  registerPayment: [ROLE.ADMIN, ROLE.CAJERO],
  viewKitchen: ROUTE_ACCESS.cocina,
  viewDelivery: ROUTE_ACCESS.deliveryPedidos,
  viewTables: ROUTE_ACCESS.mesas,
  viewReports: ROUTE_ACCESS.reportes
})

export const DEFAULT_ROUTE_BY_ROLE = Object.freeze({
  [ROLE.ADMIN]: '/dashboard',
  [ROLE.MOZO]: '/mesas',
  [ROLE.COCINERO]: '/cocina',
  [ROLE.CAJERO]: '/dashboard',
  [ROLE.DELIVERY]: '/delivery/pedidos'
})

export const hasRoleAccess = (role, allowedRoles = []) =>
  Boolean(role && allowedRoles.includes(role))

export const canAccessRouteByKey = (role, routeKey) =>
  hasRoleAccess(role, ROUTE_ACCESS[routeKey] || [])

export const canAccessCapability = (role, capability) =>
  hasRoleAccess(role, CAPABILITY_ACCESS[capability] || [])

export const getDefaultRouteForRole = (role) =>
  DEFAULT_ROUTE_BY_ROLE[role] || '/login'
