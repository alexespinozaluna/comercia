-- Migration: TipoMovimiento reference table
-- Creates the TipoMovimiento lookup table with seed data.
--
-- This table defines the meaning and behavior of each movement type:
--   Operacion: INGRESO (stock increases), SALIDA (stock decreases), AJUSTE (sets stock)
--   Efecto:   Suma (add to Cantidad), Resta (subtract from Cantidad), Suma o Resta (calculated)
--
-- Seed data:
--   1 = Venta            | Salida  | Resta
--   2 = Compra           | Ingreso | Suma
--   3 = Fabricación       | Ingreso | Suma
--   4 = Merma / Daño     | Salida  | Resta
--   5 = Vencimiento      | Salida  | Resta
--   6 = Inventario Físico | Ajuste  | Suma o Resta (calculated)

-- Create the table
CREATE TABLE IF NOT EXISTS "TipoMovimiento" (
  "Id" INT PRIMARY KEY,
  "Descripcion" TEXT NOT NULL,
  "Operacion" TEXT NOT NULL CHECK ("Operacion" IN ('INGRESO', 'SALIDA', 'AJUSTE')),
  "Efecto" TEXT NOT NULL CHECK ("Efecto" IN ('Suma', 'Resta', 'Suma o Resta')),
  "IdTenant" INT,
  "Estado" INT NOT NULL DEFAULT 1,
  "FechaCreacion" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed data (tenant-agnostic, Estado=1 means active)
INSERT INTO "TipoMovimiento" ("Id", "Descripcion", "Operacion", "Efecto", "Estado") VALUES
  (1, 'Venta', 'SALIDA', 'Resta', 1),
  (2, 'Compra', 'INGRESO', 'Suma', 1),
  (3, 'Fabricación', 'INGRESO', 'Suma', 1),
  (4, 'Merma / Daño', 'SALIDA', 'Resta', 1),
  (5, 'Vencimiento', 'SALIDA', 'Resta', 1),
  (6, 'Inventario Físico', 'AJUSTE', 'Suma o Resta', 1)
ON CONFLICT ("Id") DO UPDATE SET
  "Descripcion" = EXCLUDED."Descripcion",
  "Operacion" = EXCLUDED."Operacion",
  "Efecto" = EXCLUDED."Efecto";

-- Grant read access to anon role (custom JWT auth)
GRANT SELECT ON "TipoMovimiento" TO anon;
GRANT SELECT ON "TipoMovimiento" TO authenticated;