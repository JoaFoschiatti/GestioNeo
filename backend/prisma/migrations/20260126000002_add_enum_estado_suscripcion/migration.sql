-- Create missing EstadoSuscripcion enum
-- This enum is defined in prisma.schema but was never created in the database

CREATE TYPE "EstadoSuscripcion" AS ENUM ('PENDIENTE', 'ACTIVA', 'MOROSA', 'CANCELADA');

-- Update the suscripciones table to use the enum type
-- First, we need to check if the column already exists with a different type
-- If it exists as TEXT, we'll alter it to use the enum

DO $$
BEGIN
  -- Check if the estado column exists and alter it if needed
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'suscripciones'
    AND column_name = 'estado'
  ) THEN
    -- Convert existing values to match enum values
    UPDATE suscripciones
    SET estado = UPPER(estado)
    WHERE estado IS NOT NULL;

    -- Alter column to use enum type
    ALTER TABLE suscripciones
    ALTER COLUMN estado TYPE "EstadoSuscripcion"
    USING estado::"EstadoSuscripcion";
  END IF;
END $$;
