-- =====================================================================
-- USUARIOS: IdNegocio + UNIQUE global de Codigo
-- =====================================================================
-- Habilita la asignación de sucursal por usuario y resuelve la
-- ambigüedad de login multi-tenant fijando Codigo como UNIQUE global.
--
-- ALCANCE:
--   * SistemaUsuario gana IdNegocio (FK Negocio, NULLABLE).
--   * Backfill: usuarios no-ADMIN heredan el negocio "Principal" del
--     tenant (MIN id activo). ADMIN queda NULL.
--   * Codigo pasa a UNIQUE global → login con solo {codigo, password}.
--
-- Reglas de negocio que NO viven en la DB (se validan en la API):
--   * Rol != 'ADMIN' ⇒ IdNegocio NOT NULL.
--   * Anti-lockout: no se puede desactivar al último ADMIN del tenant.
--
-- Idempotente: re-ejecutable sin error.
-- Base: docs/plan-implementacion-usuarios-multisucursal.md (Fase 1)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SistemaUsuario.IdNegocio (nullable) + FK
-- ---------------------------------------------------------------------
ALTER TABLE "SistemaUsuario" ADD COLUMN IF NOT EXISTS "IdNegocio" BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_SistemaUsuario_Negocio') THEN
    ALTER TABLE "SistemaUsuario" ADD CONSTRAINT "FK_SistemaUsuario_Negocio"
      FOREIGN KEY ("IdNegocio") REFERENCES "Negocio"(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IX_SistemaUsuario_IdNegocio" ON "SistemaUsuario"("IdNegocio");

-- ---------------------------------------------------------------------
-- 2. Backfill: usuarios no-ADMIN heredan el Negocio Principal del tenant
--    (MIN id activo). ADMIN queda NULL → puede navegar todas las sucursales.
-- ---------------------------------------------------------------------
UPDATE "SistemaUsuario" u
SET "IdNegocio" = (
  SELECT id FROM "Negocio"
  WHERE "IdTenant" = u."IdTenant" AND "Estado" = 1
  ORDER BY id ASC
  LIMIT 1
)
WHERE u."IdNegocio" IS NULL AND u."Rol" <> 'ADMIN';

-- ---------------------------------------------------------------------
-- 3. UNIQUE global en Codigo (login multi-tenant: resuelve tenant
--    desde el codigo sin necesidad de input adicional en el form).
--    Si existen duplicados, este paso falla; resolverlos manualmente
--    antes de re-ejecutar.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SistemaUsuario_codigo_unique') THEN
    ALTER TABLE "SistemaUsuario" ADD CONSTRAINT "SistemaUsuario_codigo_unique"
      UNIQUE ("Codigo");
  END IF;
END $$;

-- =====================================================================
-- VERIFICACIÓN (ejecutar aparte tras correr la migración)
-- =====================================================================
-- Usuarios no-ADMIN sin sucursal (debe dar 0):
--   SELECT count(*) FROM "SistemaUsuario"
--   WHERE "IdNegocio" IS NULL AND "Rol" <> 'ADMIN';
--
-- Codigos duplicados (debe dar 0; si no, la UNIQUE falló o se corrió antes):
--   SELECT "Codigo", count(*) FROM "SistemaUsuario"
--   GROUP BY "Codigo" HAVING count(*) > 1;
--
-- Distribución por sucursal:
--   SELECT "IdNegocio", count(*) FROM "SistemaUsuario"
--   GROUP BY "IdNegocio" ORDER BY 1;
