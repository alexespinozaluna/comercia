-- =====================================================================
-- Auditoría multi-tenant: IdTenant en DocumentoAudit / DocumentoItemAudit
-- =====================================================================
-- Problema: las tablas de auditoría no tienen IdTenant y el API las
-- consultaba sin aislamiento → cualquier usuario autenticado podía ver
-- la auditoría de todos los tenants.
--
-- Solución:
--   1. Columna IdTenant (nullable) en ambas tablas.
--   2. fn_audit_documento / fn_audit_documento_item la pueblan:
--      - Documento: directo de NEW/OLD (la fila trae IdTenant).
--      - DocumentoItem: subselect al Documento padre (el item NO tiene
--        IdTenant). En un DELETE en cascada el padre puede ya no existir
--        → queda NULL (la app usa soft-delete Estado=0; caso excepcional).
--   3. Backfill desde DataNew/DataOld (el JSON trae la fila completa).
--   4. Índice (IdTenant, FechaAudit DESC) — patrón de consulta del módulo.
--
-- Idempotente: re-ejecutable sin error.
-- Base: docs/plan-correcciones-auditoria-2026-06-10.md (Fase A)

-- ---------------------------------------------------------------------
-- 1. Columnas
-- ---------------------------------------------------------------------
ALTER TABLE "DocumentoAudit" ADD COLUMN IF NOT EXISTS "IdTenant" bigint;
ALTER TABLE "DocumentoItemAudit" ADD COLUMN IF NOT EXISTS "IdTenant" bigint;

-- ---------------------------------------------------------------------
-- 2. Triggers
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_audit_documento() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN

    IF TG_OP = 'INSERT' THEN

        INSERT INTO "DocumentoAudit"
            ("IdDocumento", "Operacion", "UsuarioAudit", "DataNew", "IdTenant")
        VALUES
            (NEW.id, 'INSERT', current_user, to_jsonb(NEW), NEW."IdTenant");

        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN

        INSERT INTO "DocumentoAudit"
            ("IdDocumento", "Operacion", "UsuarioAudit", "DataOld", "DataNew", "IdTenant")
        VALUES
            (NEW.id, 'UPDATE', current_user, to_jsonb(OLD), to_jsonb(NEW), NEW."IdTenant");

        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN

        INSERT INTO "DocumentoAudit"
            ("IdDocumento", "Operacion", "UsuarioAudit", "DataOld", "IdTenant")
        VALUES
            (OLD.id, 'DELETE', current_user, to_jsonb(OLD), OLD."IdTenant");

        RETURN OLD;

    END IF;

    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_audit_documento_item() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_id_documento bigint;
    v_tenant bigint;
BEGIN

    IF TG_OP = 'DELETE' THEN
        v_id_documento := OLD."IdDocumento";
    ELSE
        v_id_documento := NEW."IdDocumento";
    END IF;

    -- DocumentoItem no tiene IdTenant: se toma del Documento padre.
    -- En un DELETE en cascada el padre puede ya no existir → NULL.
    SELECT "IdTenant" INTO v_tenant
    FROM "Documento"
    WHERE id = v_id_documento;

    IF TG_OP = 'INSERT' THEN

        INSERT INTO "DocumentoItemAudit"
            ("IdDocumentoItem", "Operacion", "UsuarioAudit", "DataNew", "IdTenant")
        VALUES
            (NEW.id, 'INSERT', current_user, to_jsonb(NEW), v_tenant);

        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN

        INSERT INTO "DocumentoItemAudit"
            ("IdDocumentoItem", "Operacion", "UsuarioAudit", "DataOld", "DataNew", "IdTenant")
        VALUES
            (NEW.id, 'UPDATE', current_user, to_jsonb(OLD), to_jsonb(NEW), v_tenant);

        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN

        INSERT INTO "DocumentoItemAudit"
            ("IdDocumentoItem", "Operacion", "UsuarioAudit", "DataOld", "IdTenant")
        VALUES
            (OLD.id, 'DELETE', current_user, to_jsonb(OLD), v_tenant);

        RETURN OLD;

    END IF;

    RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------
-- 3. Backfill de filas históricas
-- ---------------------------------------------------------------------
UPDATE "DocumentoAudit"
SET "IdTenant" = COALESCE(
        ("DataNew"->>'IdTenant')::bigint,
        ("DataOld"->>'IdTenant')::bigint
    )
WHERE "IdTenant" IS NULL;

-- Items: el JSON del item no trae IdTenant → join al Documento padre.
UPDATE "DocumentoItemAudit" a
SET "IdTenant" = d."IdTenant"
FROM "Documento" d
WHERE a."IdTenant" IS NULL
  AND d.id = COALESCE(
        (a."DataNew"->>'IdDocumento')::bigint,
        (a."DataOld"->>'IdDocumento')::bigint
      );

-- Segundo intento para items de documentos ya borrados: el tenant quedó
-- registrado en la auditoría del documento.
UPDATE "DocumentoItemAudit" a
SET "IdTenant" = sub."IdTenant"
FROM (
    SELECT DISTINCT "IdDocumento",
           COALESCE(
               ("DataNew"->>'IdTenant')::bigint,
               ("DataOld"->>'IdTenant')::bigint
           ) AS "IdTenant"
    FROM "DocumentoAudit"
) sub
WHERE a."IdTenant" IS NULL
  AND sub."IdTenant" IS NOT NULL
  AND sub."IdDocumento" = COALESCE(
        (a."DataNew"->>'IdDocumento')::bigint,
        (a."DataOld"->>'IdDocumento')::bigint
      );

-- ---------------------------------------------------------------------
-- 4. Índices para el listado filtrado por tenant + rango de fechas
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "idx_DocumentoAudit_tenant_fecha"
    ON "DocumentoAudit" ("IdTenant", "FechaAudit" DESC);

CREATE INDEX IF NOT EXISTS "idx_DocumentoItemAudit_tenant_fecha"
    ON "DocumentoItemAudit" ("IdTenant", "FechaAudit" DESC);
