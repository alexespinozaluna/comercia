-- =====================================================================
-- RENOMBRE — ProductoMovimiento.IdUsuario → ProductoMovimiento.IdUsuarioCreacion
-- =====================================================================
-- Consistencia con la convención general de auditoría (Fase 1).
-- ProductoMovimiento es una tabla inmutable (log de kardex) → solo
-- IdUsuarioCreacion + FechaCreacion (mapeada al campo "Fecha" existente).
--
-- Idempotente: re-ejecutable sin error.
-- Base: docs/plan-auditoria-columnas.md (Fase 2)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Renombre de columna (solo si todavía se llama IdUsuario)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ProductoMovimiento'
      AND column_name = 'IdUsuario'
  ) THEN
    ALTER TABLE public."ProductoMovimiento"
      RENAME COLUMN "IdUsuario" TO "IdUsuarioCreacion";
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2. FK + índice (idempotentes)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_ProductoMovimiento_UsuarioCreacion') THEN
    ALTER TABLE public."ProductoMovimiento" ADD CONSTRAINT "FK_ProductoMovimiento_UsuarioCreacion"
      FOREIGN KEY ("IdUsuarioCreacion") REFERENCES public."SistemaUsuario"(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IX_ProductoMovimiento_IdUsuarioCreacion"
  ON public."ProductoMovimiento"("IdUsuarioCreacion");

-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
-- Confirmar que la columna ahora se llama IdUsuarioCreacion:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='ProductoMovimiento'
--     AND column_name IN ('IdUsuario','IdUsuarioCreacion');
-- Debe devolver solo: IdUsuarioCreacion
