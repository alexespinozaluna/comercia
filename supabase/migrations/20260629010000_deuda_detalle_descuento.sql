-- =====================================================================
-- v_deuda_detalle: exponer Importe (bruto) y Descuento
-- =====================================================================
-- deuda-detalle y la página pública de deuda muestran el descuento por venta
-- (línea "Imp · Desc" bajo el monto) y el ahorro total del cliente. La vista
-- no exponía estas columnas, así que se agregan AL FINAL (CREATE OR REPLACE
-- VIEW sin DROP/CASCADE, como en 20260614000000). Idempotente.
-- Base: 20260614000000.
-- =====================================================================

CREATE OR REPLACE VIEW v_deuda_detalle AS
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
  public.fn_fecha_hora(d."FechaEmision", d."FechaCreacion") AS "FechaHora",
  d."DireccionEntrega",
  d."Total",
  d."Saldo",
  d."TotalAbono",
  d."bCredito",
  d."IdTipoDocumento",
  d."IdUsuarioCreacion",
  c."Nombre"      AS "NomCliente",
  c."NroTelefono" AS "NroTelefono",
  u."Nombre"      AS "NomUsuarioCreacion",
  c."NroDocumento" AS "NroDocumento",
  -- columnas nuevas al final (requisito de CREATE OR REPLACE VIEW)
  d."Importe"   AS "Importe",
  d."Descuento" AS "Descuento"
FROM "Documento" d
LEFT JOIN "Cliente" c        ON c.id = d."IdCliente"
LEFT JOIN "SistemaUsuario" u ON u.id = d."IdUsuarioCreacion"
WHERE d."bCredito" = true
  AND d."Saldo"    > 0
  AND d."Estado"   = 1;

GRANT SELECT ON v_deuda_detalle TO anon, authenticated;
