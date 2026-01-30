#!/usr/bin/env node

/**
 * Cleanup Expired Tokens Script
 *
 * This script removes expired tokens from the database to prevent table bloat:
 * - Expired and revoked refresh tokens
 * - Expired and unused email verification tokens
 *
 * Usage:
 *   node scripts/maintenance/cleanup-expired-tokens.js
 *
 * Recommended: Run daily via cron job
 *   0 2 * * * cd /path/to/backend && node scripts/maintenance/cleanup-expired-tokens.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupExpiredTokens() {
  console.log('🧹 Starting token cleanup...');
  console.log('Timestamp:', new Date().toISOString());

  try {
    // 1. Delete expired and revoked refresh tokens
    const deletedRefreshTokens = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          // Expired tokens
          { expiresAt: { lt: new Date() } },
          // Revoked tokens older than 30 days (keep recent ones for audit)
          {
            revokedAt: {
              not: null,
              lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          }
        ]
      }
    });

    console.log(`✅ Deleted ${deletedRefreshTokens.count} expired/revoked refresh tokens`);

    // 2. Delete expired email verification tokens (not used)
    const deletedEmailVerifications = await prisma.emailVerificacion.deleteMany({
      where: {
        AND: [
          { expiresAt: { lt: new Date() } },
          { usedAt: null }
        ]
      }
    });

    console.log(`✅ Deleted ${deletedEmailVerifications.count} expired email verification tokens`);

    // 3. Optional: Delete very old used email verifications (older than 90 days)
    const deletedOldUsedVerifications = await prisma.emailVerificacion.deleteMany({
      where: {
        AND: [
          { usedAt: { not: null } },
          { usedAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } }
        ]
      }
    });

    console.log(`✅ Deleted ${deletedOldUsedVerifications.count} old used email verifications`);

    // Summary
    const totalDeleted =
      deletedRefreshTokens.count +
      deletedEmailVerifications.count +
      deletedOldUsedVerifications.count;

    console.log(`\n📊 Summary: Deleted ${totalDeleted} total records`);
    console.log('✨ Token cleanup completed successfully');

  } catch (error) {
    console.error('❌ Error during token cleanup:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupExpiredTokens()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
