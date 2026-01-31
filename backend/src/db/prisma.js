/**
 * Centralized Prisma Client
 *
 * Simple singleton Prisma client (no multi-tenancy)
 */

const { PrismaClient } = require('@prisma/client');

// Singleton Prisma client
const prisma = new PrismaClient();

module.exports = {
  prisma
};
