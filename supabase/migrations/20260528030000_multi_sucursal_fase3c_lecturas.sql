-- =====================================================================
-- MULTI-SUCURSAL — FASE 3c: lecturas por sucursal (deuda) + re-backfill
-- =====================================================================
-- 1) Re-backfill de filas creadas en el intervalo nullable con IdNegocio
--    NULL → negocio Principal de su tenant. Así el filtrado por sucursal
--    no esconde nada.
-- 2) v_deuda_detalle expone IdNegocio.
-- 3) fn_deuda_resumen acepta p_id_negocio (NULL = sin filtro, nivel cuenta;
--    p.ej. el link público de deuda agrega todas las sucursales).
--
-- El filtrado real lo aplican los servicios TS (getVentas, getDeuda*,
-- getHistorial, kardex) usando user.idNegocio. Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Re-backfill de IdNegocio NULL (Principal = MIN id de negocios del tenant)
-- ---------------------------------------------------------------------
UPDATE "Documento" d
SET "IdNegocio" = pr.id_negocio
FROM (SELECT "IdTenant", MIN(id) AS id_negocio FROM "Negocio" GROUP BY "IdTenant") pr
WHERE d."IdTenant" = pr."IdTenant" AND d."IdNegocio" IS NULL;

UPDATE "DocumentoItem" di
SET "IdNegocio" = d."IdNegocio"
FROM "Documento" d
WHERE di."IdDocumento" = d.id AND di."IdNegocio" IS NULL;

UPDATE "DocumentoItem" di
SET "IdNegocio" = pr.id_negocio
FROM (SELECT "IdTenant", MIN(id) AS id_negocio FROM "Negocio" GROUP BY "IdTenant") pr
WHERE di."IdTenant" = pr."IdTenant" AND di."IdNegocio" IS NULL;

UPDATE "Caja" c
SET "IdNegocio" = pr.id_negocio
FROM (SELECT "IdTenant", MIN(id) AS id_negocio FROM "Negocio" GROUP BY "IdTenant") pr
WHERE c."IdTenant" = pr."IdTenant" AND c."IdNegocio" IS NULL;

UPDATE "ProductoMovimiento" m
SET "IdNegocio" = pr.id_negocio
FROM (SELECT "IdTenant", MIN(id) AS id_negocio FROM "Negocio" GROUP BY "IdTenant") pr
WHERE m."IdTenant" = pr."IdTenant" AND m."IdNegocio" IS NULL;

-- ---------------------------------------------------------------------
-- 2. v_deuda_detalle + IdNegocio  (DROP CASCADE: fn_deuda_resumen depende)
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS v_deuda_detalle CASCADE;

CREATE VIEW v_deuda_detalle AS
SELECT
  d.id,
  d."IdTenant",
  d."IdNegocio",
  d."Estado",
  d."IdCliente",
  d."Concepto",
  d."Descripcion",
  d."FechaEmision",
  d."FechaCreacion",
  d."DireccionEntrega",
  d."Total",
  d."Saldo",
  d."TotalAbono",
  d."bCredito",
  d."IdTipoDocumento",
  c."Nombre"      AS "NomCliente",
  c."NroTelefono" AS "NroTelefono"
FROM "Documento" d
LEFT JOIN "Cliente" c ON c.id = d."IdCliente"
WHERE d."bCredito" = true
  AND d."Saldo"    > 0
  AND d."Estado"   = 1;

COMMENT ON VIEW v_deuda_detalle IS
  'Detalle de documentos con deuda activa (bCredito + Saldo>0 + Estado=1). Incluye IdNegocio. Join a Cliente.';

-- ---------------------------------------------------------------------
-- 3. fn_deuda_resumen(p_id_tenant, p_id_negocio) — p_id_negocio NULL = sin filtro
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_deuda_resumen(p_id_tenant INTEGER, p_id_negocio BIGINT DEFAULT NULL)
RETURNS TABLE (
  "IdCliente"       BIGINT,
  "NomCliente"      TEXT,
  "NroTelefono"     TEXT,
  "Cantidad"        BIGINT,
  "SumSaldo"        NUMERIC,
  "MaxFechaEmision" DATE,
  "MaxId"           BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    v."IdCliente",
    v."NomCliente"::TEXT,
    v."NroTelefono"::TEXT,
    COUNT(*)                       AS "Cantidad",
    SUM(v."Saldo")                 AS "SumSaldo",
    MAX(v."FechaEmision")::DATE    AS "MaxFechaEmision",
    MAX(v.id)                      AS "MaxId"
  FROM v_deuda_detalle v
  WHERE v."IdTenant"  = p_id_tenant
    AND v."IdCliente" IS NOT NULL
    AND (p_id_negocio IS NULL OR v."IdNegocio" = p_id_negocio)
  GROUP BY v."IdCliente", v."NomCliente", v."NroTelefono"
 ORDER BY
       MAX(v."FechaEmision") DESC,
    MAX(v.id) DESC;
$$;

COMMENT ON FUNCTION fn_deuda_resumen(INTEGER, BIGINT) IS
  'Resumen de deuda por cliente para un tenant (y sucursal si p_id_negocio). Ordenado por fecha DESC.';

GRANT SELECT  ON v_deuda_detalle TO anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_deuda_resumen(INTEGER, BIGINT) TO anon, authenticated;
