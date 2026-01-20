/**
 * Centralized Prisma Client with Multi-Tenancy Support
 *
 * This module provides:
 * - A singleton Prisma client instance
 * - A tenant-scoped Prisma client factory
 * - Automatic tenantId injection for all queries
 */

const { PrismaClient } = require('@prisma/client');

// Singleton Prisma client
const prisma = new PrismaClient();

/**
 * Tables that require tenant scoping
 * Usuario is special - tenantId is nullable for SUPER_ADMIN
 */
const TENANT_SCOPED_MODELS = [
  'usuario',
  'empleado',
  'fichaje',
  'liquidacion',
  'mesa',
  'reserva',
  'categoria',
  'producto',
  'modificador',
  'productoModificador',
  'ingrediente',
  'productoIngrediente',
  'movimientoStock',
  'pedido',
  'pedidoItem',
  'pedidoItemModificador',
  'pago',
  'cierreCaja',
  'printJob',
  'configuracion',
  'emailVerificacion'
];

/**
 * Creates a tenant-scoped Prisma client that automatically
 * injects tenantId into all queries for tenant-owned models.
 *
 * @param {number} tenantId - The tenant ID to scope queries to
 * @param {boolean} isSuperAdmin - If true, bypasses tenant scoping
 * @returns {PrismaClient} Extended Prisma client with tenant scoping
 */
const getTenantPrisma = (tenantId, isSuperAdmin = false) => {
  // Super admin bypasses tenant scoping
  if (isSuperAdmin) {
    return prisma;
  }

  if (!tenantId) {
    throw new Error('tenantId is required for tenant-scoped queries');
  }

  return prisma.$extends({
    name: 'tenantScoping',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // Only scope tenant-owned models
          const modelLower = model.charAt(0).toLowerCase() + model.slice(1);
          if (!TENANT_SCOPED_MODELS.includes(modelLower)) {
            return query(args);
          }

          // Initialize args if undefined
          if (!args) args = {};

          // Read operations - add tenantId to where clause
          if (['findMany', 'findFirst', 'findUnique', 'count', 'aggregate', 'groupBy'].includes(operation)) {
            args.where = { ...(args.where || {}), tenantId };
          }

          // Update/Delete operations - add tenantId to where clause
          if (['update', 'updateMany', 'delete', 'deleteMany', 'upsert'].includes(operation)) {
            args.where = { ...(args.where || {}), tenantId };
          }

          // Create operations - add tenantId to data
          if (operation === 'create') {
            args.data = { ...(args.data || {}), tenantId };
          }

          if (operation === 'createMany') {
            if (Array.isArray(args.data)) {
              args.data = args.data.map(d => ({ ...d, tenantId }));
            } else {
              args.data = { ...(args.data || {}), tenantId };
            }
          }

          // Upsert - add tenantId to both create and update
          if (operation === 'upsert') {
            args.create = { ...(args.create || {}), tenantId };
            args.update = { ...(args.update || {}) };
          }

          return query(args);
        }
      }
    }
  });
};

/**
 * Resolves a tenant by slug
 *
 * @param {string} slug - The tenant slug
 * @returns {Promise<Object|null>} The tenant object or null if not found
 */
const getTenantBySlug = async (slug) => {
  if (!slug) return null;

  return prisma.tenant.findUnique({
    where: { slug }
  });
};

/**
 * Resolves a tenant by ID
 *
 * @param {number} tenantId - The tenant ID
 * @returns {Promise<Object|null>} The tenant object or null if not found
 */
const getTenantById = async (tenantId) => {
  if (!tenantId) return null;

  return prisma.tenant.findUnique({
    where: { id: tenantId }
  });
};

module.exports = {
  prisma,
  getTenantPrisma,
  getTenantBySlug,
  getTenantById,
  TENANT_SCOPED_MODELS
};
