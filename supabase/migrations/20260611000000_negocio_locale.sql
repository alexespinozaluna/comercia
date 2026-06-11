-- =====================================================================
-- Locale por Negocio: formato de fechas y números según el país
-- =====================================================================
-- El formato (es-CL, es-PE, …) deja de ser per-deployment
-- (NEXT_PUBLIC_LOCALE) y pasa a ser configuración del negocio en BD,
-- para soportar cuentas/sucursales de distintos países en una misma
-- instancia. El DEFAULT cubre las filas existentes; sin backfill.
--
-- Valores válidos (validados en el API contra LOCALES_VALIDOS de
-- src/types/locale.ts): es-CL, es-PE, es-AR, es-BO, es-CO, es-MX.
--
-- Idempotente: re-ejecutable sin error.
-- Base: docs/plan-locale-por-negocio.md (Fase 1)

ALTER TABLE "Negocio"
    ADD COLUMN IF NOT EXISTS "Locale" varchar(10) NOT NULL DEFAULT 'es-CL';
