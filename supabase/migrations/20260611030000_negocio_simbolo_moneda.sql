-- =====================================================================
-- Símbolo de moneda por Negocio
-- =====================================================================
-- El símbolo que antecede los montos deja de ser el literal "$" del
-- código. Vacío (default) = se deriva del Locale del negocio (moneda
-- nacional: es-CL → $, es-PE → S/, es-BO → Bs, …); con valor = se usa
-- tal cual (texto libre, p. ej. "US$").
--
-- Diseño puente: a futuro habrá una tabla Moneda para ventas
-- multi-moneda por documento; este campo quedará como el símbolo de
-- presentación por defecto del negocio (no compiten).
--
-- Idempotente: re-ejecutable sin error.
-- Base: docs/plan-simbolo-moneda-por-negocio.md

ALTER TABLE "Negocio"
    ADD COLUMN IF NOT EXISTS "SimboloMoneda" varchar(8) NOT NULL DEFAULT '';
