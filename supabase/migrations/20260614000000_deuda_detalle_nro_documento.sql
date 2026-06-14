-- =====================================================================
-- v_deuda_detalle: agregar NroDocumento del cliente
-- =====================================================================
-- La página pública de deuda (p/deuda/[token]) muestra datos del cliente en
-- el header (nombre, teléfono y N° de documento). La vista no exponía
-- NroDocumento, así que se agrega.
--
-- Se usa CREATE OR REPLACE VIEW con la columna nueva AL FINAL: Postgres lo
-- permite sin DROP mientras no se cambien las columnas existentes (mismo
-- nombre/tipo/orden). Así NO se hace CASCADE y NO se toca fn_deuda_resumen
-- (que ya no necesariamente depende de la vista). Idempotente.
-- Base: 20260606170000.
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
  -- columna nueva al final (requisito de CREATE OR REPLACE VIEW)
  c."NroDocumento" AS "NroDocumento"
FROM "Documento" d
LEFT JOIN "Cliente" c        ON c.id = d."IdCliente"
LEFT JOIN "SistemaUsuario" u ON u.id = d."IdUsuarioCreacion"
WHERE d."bCredito" = true
  AND d."Saldo"    > 0
  AND d."Estado"   = 1;

GRANT SELECT ON v_deuda_detalle TO anon, authenticated;
