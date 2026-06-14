-- ============================================================================
-- MetodoPago.bDeuda — flag semántico del método para ventas a crédito
-- ----------------------------------------------------------------------------
-- Antes el método de crédito se identificaba por Nombre = 'Deuda' (frágil:
-- se rompe si se renombra/traduce). Se agrega un flag booleano, igual que el
-- ya existente bEfectivo, para identificarlo por semántica y no por texto.
--
-- Idempotente. Requiere que ya exista el método "Deuda" (migración
-- 20260613010000_metodo_pago_deuda.sql).
-- ============================================================================

-- 1. Columna (default false: ningún método es "deuda" salvo el marcado).
ALTER TABLE public."MetodoPago"
  ADD COLUMN IF NOT EXISTS "bDeuda" boolean NOT NULL DEFAULT false;

-- 2. Marcar el método "Deuda" ya creado por la migración anterior.
UPDATE public."MetodoPago"
SET "bDeuda" = true
WHERE "Nombre" = 'Deuda'
  AND "bDeuda" = false;

-- 3. Garantizar a lo sumo UN método de deuda activo por tenant.
CREATE UNIQUE INDEX IF NOT EXISTS "UX_MetodoPago_DeudaPorTenant"
  ON public."MetodoPago" ("IdTenant")
  WHERE "bDeuda" AND "Estado" = 1;
