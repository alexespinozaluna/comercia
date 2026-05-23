-- =============================================================
-- Add FechaVencimiento column to Producto table
-- Execute this script in Supabase SQL Editor
-- =============================================================

-- Add expiry date column for products
ALTER TABLE "Producto"
ADD COLUMN IF NOT EXISTS "FechaVencimiento" DATE DEFAULT NULL;

-- Optional: Create index for expiry alert queries
CREATE INDEX IF NOT EXISTS "idx_producto_fechavencimiento"
ON "Producto" ("FechaVencimiento")
WHERE "FechaVencimiento" IS NOT NULL;