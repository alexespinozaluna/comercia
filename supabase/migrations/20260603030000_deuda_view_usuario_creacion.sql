-- =====================================================================
-- v_deuda_detalle — expone IdUsuarioCreacion + NomUsuarioCreacion
-- =====================================================================
-- Para que /deuda-detalle y otras vistas que consumen v_deuda_detalle
-- puedan mostrar quién creó cada documento sin un round-trip adicional.
--
-- DROP CASCADE recrea también fn_deuda_resumen (que depende de la vista).
-- Idempotente.
-- Base: docs/plan-auditoria-columnas.md (extensión Fase 6 a listas)
-- =====================================================================

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
  d."IdUsuarioCreacion",
  c."Nombre"      AS "NomCliente",
  c."NroTelefono" AS "NroTelefono",
  u."Nombre"      AS "NomUsuarioCreacion"
FROM "Documento" d
LEFT JOIN "Cliente" c        ON c.id = d."IdCliente"
LEFT JOIN "SistemaUsuario" u ON u.id = d."IdUsuarioCreacion"
WHERE d."bCredito" = true
  AND d."Saldo"    > 0
  AND d."Estado"   = 1;

COMMENT ON VIEW v_deuda_detalle IS
  'Detalle de documentos con deuda activa. Incluye IdNegocio + creador (NomUsuarioCreacion).';

-- Recrear fn_deuda_resumen. DROP explícito porque su body referencia
-- v_deuda_detalle (dependencia "soft" que CASCADE no elimina) y necesitamos
-- preservar la firma TEXT del retorno (igual a la migración 20260528030000).
DROP FUNCTION IF EXISTS fn_deuda_resumen(INTEGER, BIGINT);

CREATE FUNCTION fn_deuda_resumen(p_id_tenant INTEGER, p_id_negocio BIGINT DEFAULT NULL)
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
  ORDER BY MAX(v."FechaEmision") DESC, MAX(v.id) DESC;
$$;

COMMENT ON FUNCTION fn_deuda_resumen(INTEGER, BIGINT) IS
  'Resumen de deuda por cliente para un tenant (y sucursal si p_id_negocio). Ordenado por fecha DESC.';

GRANT SELECT  ON v_deuda_detalle TO anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_deuda_resumen(INTEGER, BIGINT) TO anon, authenticated;
