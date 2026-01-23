/**
 * Centralized Prisma Client with Multi-Tenancy Support
 *
 * This module provides:
 * - A singleton Prisma client instance
 * - A tenant-scoped Prisma client factory
 * - Automatic tenantId injection for all queries
 */

const { PrismaClient } = require('@prisma/client');
const { createHttpError } = require('../utils/http-error');

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
  'mercadoPagoConfig',
  'transaccionMercadoPago',
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

          const shouldScopeWhere = [
            'findMany',
            'findFirst',
            'count',
            'aggregate',
            'groupBy',
            'updateMany',
            'deleteMany'
          ].includes(operation);

          if (shouldScopeWhere) {
            args.where = { ...(args.where || {}), tenantId };
          }

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

          if (operation === 'upsert') {
            args.create = { ...(args.create || {}), tenantId };

            const existing = await prisma[modelLower].findUnique({
              where: args.where,
              select: { tenantId: true }
            });

            if (existing && existing.tenantId !== tenantId) {
              throw createHttpError.notFound('Registro no encontrado');
            }

            return query(args);
          }

          if (operation === 'update' || operation === 'delete') {
            const existing = await prisma[modelLower].findUnique({
              where: args.where,
              select: { tenantId: true }
            });

            if (existing && existing.tenantId !== tenantId) {
              throw createHttpError.notFound('Registro no encontrado');
            }

            return query(args);
          }

          if (operation === 'findUnique') {
            const hadSelect = Boolean(args.select);
            const hadTenantSelected = hadSelect && args.select && args.select.tenantId === true;

            if (hadSelect && !hadTenantSelected) {
              args.select = { ...args.select, tenantId: true };
            }

            const result = await query(args);

            if (!result) return null;
            if (result.tenantId !== tenantId) return null;

            if (hadSelect && !hadTenantSelected) {
              const { tenantId: _ignored, ...rest } = result;
              return rest;
            }

            return result;
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
