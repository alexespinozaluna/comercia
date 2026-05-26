-- =============================================================
-- Migration: vistas y funciones de Deuda
--
-- Objetivo:
--   Mover el agregado de deudas (count, sum, max fecha por cliente) desde
--   el frontend a la base de datos. Reduce payload y elimina pasadas
--   de JavaScript sobre arrays grandes.
--
-- Convenciones:
--   - Columnas en PascalCase con doble comilla (consistente con el schema).
--   - Filtros multi-tenant via parametro p_id_tenant.
--   - Una "deuda activa" cumple: bCredito = true AND Saldo > 0 AND Estado = 1.
--
-- Cómo aplicar:
--   1) Ir a Supabase Dashboard → SQL Editor.
--   2) Pegar este archivo completo y ejecutar.
--   3) Verificar que la vista y la funcion existen:
--        SELECT * FROM v_deuda_detalle LIMIT 1;
--        SELECT * FROM fn_deuda_resumen(<TU_ID_TENANT>);
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- Vista: v_deuda_detalle
-- Filas: una por documento con deuda activa.
-- Incluye join a Cliente para exponer NomCliente / NroTelefono.
-- ─────────────────────────────────────────────────────────────

-- DROP CASCADE porque la funcion fn_deuda_resumen depende de la vista.
-- La funcion se recrea mas abajo en este mismo script.
DROP VIEW IF EXISTS v_deuda_detalle CASCADE;

CREATE VIEW v_deuda_detalle AS
SELECT
  d.id,
  d."IdTenant",
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
  'Detalle de documentos con deuda activa (bCredito + Saldo>0 + Estado=1). Join a Cliente.';

-- ─────────────────────────────────────────────────────────────
-- Funcion: fn_deuda_resumen(p_id_tenant)
-- Resumen agregado por cliente, ordenado por monto pendiente DESC.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_deuda_resumen(p_id_tenant INTEGER)
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
  GROUP BY v."IdCliente", v."NomCliente", v."NroTelefono"
 ORDER BY 
       MAX(v."FechaEmision") DESC,
    MAX(v.id) DESC;
$$;

COMMENT ON FUNCTION fn_deuda_resumen(INTEGER) IS
  'Resumen de deuda por cliente para un tenant. Ordenado por monto pendiente DESC.';

-- ─────────────────────────────────────────────────────────────
-- Grants
-- El proyecto usa la anon key para todas las queries server-side
-- (la auth es a nivel aplicación via JWT propio). Por eso anon
-- necesita SELECT sobre la vista y EXECUTE sobre la funcion.
-- Se agrega authenticated tambien por si se migra a Supabase Auth.
-- ─────────────────────────────────────────────────────────────

GRANT SELECT  ON v_deuda_detalle              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_deuda_resumen(INTEGER) TO anon, authenticated;
