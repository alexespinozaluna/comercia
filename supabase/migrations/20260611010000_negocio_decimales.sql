-- =====================================================================
-- Decimales de montos por Negocio
-- =====================================================================
-- Cuántos decimales muestran los montos: 0 (enteros, estilo CLP) o
-- 2 (centavos, estilo PEN). Complementa Negocio.Locale (migración
-- 20260611000000). DEFAULT 0 = comportamiento actual; sin backfill.
-- Valores válidos (validados en el API): 0 | 2.
--
-- Idempotente: re-ejecutable sin error.
-- Base: docs/plan-decimales-por-negocio.md (Fase 1)

ALTER TABLE "Negocio"
    ADD COLUMN IF NOT EXISTS "Decimales" smallint NOT NULL DEFAULT 0;
