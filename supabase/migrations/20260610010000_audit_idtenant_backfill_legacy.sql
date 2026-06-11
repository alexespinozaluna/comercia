-- =====================================================================
-- Backfill legacy: IdTenant en filas de auditoría previas a multi-tenant
-- =====================================================================
-- La migración 20260610000000 backfilleó desde DataNew/DataOld, pero las
-- filas de antes de la migración multi-tenant (mayo 2026) tienen un JSON
-- sin IdTenant → quedaron NULL (11 en DocumentoAudit, 4 en
-- DocumentoItemAudit, verificado 2026-06-10).
--
-- Estrategia:
--   1. Join al Documento vivo (la fila actual sí tiene IdTenant).
--   2. Items: segundo intento vía DocumentoAudit ya resuelto.
--   3. Fallback: si en la BD existe UN solo tenant, los NULL restantes
--      (documentos borrados, ej. id 682) le pertenecen por definición.
--      Con más de un tenant el fallback no hace nada (guard por count).
--
-- Idempotente: re-ejecutable sin error.
-- Base: docs/plan-correcciones-auditoria-2026-06-10.md (Fase A)

-- 1. Documento vivo
UPDATE "DocumentoAudit" a
SET "IdTenant" = d."IdTenant"
FROM "Documento" d
WHERE a."IdTenant" IS NULL
  AND d.id = a."IdDocumento";

UPDATE "DocumentoItemAudit" a
SET "IdTenant" = d."IdTenant"
FROM "Documento" d
WHERE a."IdTenant" IS NULL
  AND d.id = COALESCE(
        (a."DataNew"->>'IdDocumento')::bigint,
        (a."DataOld"->>'IdDocumento')::bigint
      );

-- 2. Items de documentos borrados: tenant desde la auditoría del documento
UPDATE "DocumentoItemAudit" a
SET "IdTenant" = sub."IdTenant"
FROM (
    SELECT DISTINCT "IdDocumento", "IdTenant"
    FROM "DocumentoAudit"
    WHERE "IdTenant" IS NOT NULL
) sub
WHERE a."IdTenant" IS NULL
  AND sub."IdDocumento" = COALESCE(
        (a."DataNew"->>'IdDocumento')::bigint,
        (a."DataOld"->>'IdDocumento')::bigint
      );

-- 3. Fallback single-tenant: solo actúa si existe exactamente un tenant
UPDATE "DocumentoAudit"
SET "IdTenant" = (SELECT id FROM "SistemaTenant")
WHERE "IdTenant" IS NULL
  AND (SELECT count(*) FROM "SistemaTenant") = 1;

UPDATE "DocumentoItemAudit"
SET "IdTenant" = (SELECT id FROM "SistemaTenant")
WHERE "IdTenant" IS NULL
  AND (SELECT count(*) FROM "SistemaTenant") = 1;
