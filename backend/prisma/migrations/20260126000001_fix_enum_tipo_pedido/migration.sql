-- Add missing ONLINE value to TipoPedido enum
-- This fixes the schema mismatch between prisma.schema and database

ALTER TYPE "TipoPedido" ADD VALUE IF NOT EXISTS 'ONLINE';
