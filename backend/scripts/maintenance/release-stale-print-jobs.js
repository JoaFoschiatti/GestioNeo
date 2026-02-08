#!/usr/bin/env node

/**
 * Release Stale Print Jobs Script
 *
 * This script releases print jobs that are stuck in IMPRIMIENDO status
 * when the printer dies or loses connection. Jobs claimed for more than
 * the timeout period are released back to PENDIENTE status for retry.
 *
 * Usage:
 *   node scripts/maintenance/release-stale-print-jobs.js [timeout-minutes]
 *
 * Examples:
 *   node scripts/maintenance/release-stale-print-jobs.js      # Default: 5 minutes
 *   node scripts/maintenance/release-stale-print-jobs.js 10   # Custom: 10 minutes
 *
 * Recommended: Run every 5 minutes via cron job.
 * Example: cd /path/to/backend && node scripts/maintenance/release-stale-print-jobs.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Default timeout: 5 minutes
const DEFAULT_TIMEOUT_MINUTES = 5;

async function releaseStalePrintJobs(timeoutMinutes = DEFAULT_TIMEOUT_MINUTES) {
  console.log('🖨️  Checking for stale print jobs...');
  console.log('Timestamp:', new Date().toISOString());
  console.log(`Timeout: ${timeoutMinutes} minutes`);

  const timeoutDate = new Date(Date.now() - timeoutMinutes * 60 * 1000);

  try {
    // Find stale jobs (stuck in IMPRIMIENDO for too long)
    const staleJobs = await prisma.printJob.findMany({
      where: {
        status: 'IMPRIMIENDO',
        claimedAt: {
          lt: timeoutDate
        }
      },
      select: {
        id: true,
        pedidoId: true,
        tipo: true,
        claimedBy: true,
        claimedAt: true,
        intentos: true,
        maxIntentos: true
      }
    });

    if (staleJobs.length === 0) {
      console.log('✅ No stale print jobs found');
      return;
    }

    console.log(`⚠️  Found ${staleJobs.length} stale print jobs`);

    // Release each stale job
    let released = 0;
    let maxed = 0;

    for (const job of staleJobs) {
      const newIntentos = job.intentos + 1;

      // Check if max attempts reached
      if (newIntentos >= job.maxIntentos) {
        // Mark as ERROR after max attempts
        await prisma.printJob.update({
          where: { id: job.id },
          data: {
            status: 'ERROR',
            claimedBy: null,
            claimedAt: null,
            intentos: newIntentos,
            lastError: `Max attempts (${job.maxIntentos}) reached after printer timeout`
          }
        });
        maxed++;
        console.log(`  ❌ Job #${job.id} (Pedido #${job.pedidoId}, Tipo: ${job.tipo}) - MAX ATTEMPTS REACHED`);
      } else {
        // Release back to PENDIENTE for retry
        await prisma.printJob.update({
          where: { id: job.id },
          data: {
            status: 'PENDIENTE',
            claimedBy: null,
            claimedAt: null,
            intentos: newIntentos,
            nextAttemptAt: new Date(), // Immediate retry
            lastError: `Released after ${timeoutMinutes}min timeout (attempt ${newIntentos}/${job.maxIntentos})`
          }
        });
        released++;
        console.log(`  🔄 Job #${job.id} (Pedido #${job.pedidoId}, Tipo: ${job.tipo}) - Released (attempt ${newIntentos}/${job.maxIntentos})`);
      }
    }

    // Summary
    console.log(`\n📊 Summary:`);
    console.log(`  - Released for retry: ${released}`);
    console.log(`  - Marked as ERROR: ${maxed}`);
    console.log(`  - Total processed: ${staleJobs.length}`);
    console.log('✨ Stale print jobs processing completed');

  } catch (error) {
    console.error('❌ Error releasing stale print jobs:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const timeoutArg = process.argv[2];
const timeoutMinutes = timeoutArg ? parseInt(timeoutArg, 10) : DEFAULT_TIMEOUT_MINUTES;

if (isNaN(timeoutMinutes) || timeoutMinutes < 1) {
  console.error('❌ Invalid timeout. Must be a positive number of minutes.');
  console.error('Usage: node release-stale-print-jobs.js [timeout-minutes]');
  process.exit(1);
}

// Run the release process
releaseStalePrintJobs(timeoutMinutes)
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
