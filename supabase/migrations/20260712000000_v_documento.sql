-- =====================================================================
-- v_documento — Documento + nombres de sus joins (lista plana)
-- =====================================================================
-- Reemplaza el embed de PostgREST (Cliente(*), MetodoPago(Nombre),
-- UsuarioCreacion(Nombre)…) por una vista con los joins ya resueltos.
-- La app solo consume el `Nombre` de cada relación → se exponen planos
-- como Nom* (misma convención que v_deuda_detalle).
--
-- Reglas de diseño:
--   * `d.*` completo (todas las columnas de Documento; sin colisión porque
--     de las tablas unidas SOLO se toma su "Nombre" aliasado).
--   * SIN filtros de IdTenant / Estado / fecha y SIN ORDER BY: eso lo pone
--     cada consumidor (la vista es el join crudo, reutilizable).
--   * NO incluye DocumentoItem (una vista plana no devuelve el array de
--     ítems); el detalle con ítems sigue por getVentaConItem.
--
-- Idempotente. Base: docs/vista-v-documento-2026-07-12.md
-- =====================================================================

DROP VIEW IF EXISTS v_documento;

CREATE VIEW v_documento AS
SELECT
    d.*,
    c."Nombre"  AS "NomCliente",
    mp."Nombre" AS "NomMetodoPago",
    su."Nombre" AS "NomUsuarioCreacion",
    sm."Nombre" AS "NomUsuarioModificacion",
    td."Nombre" AS "NomTipoDoc"
FROM "Documento" d
LEFT JOIN "Cliente"        c  ON c.id  = d."IdCliente"
LEFT JOIN "TipoDocumento"  td ON td.id = d."IdTipoDocumento"
LEFT JOIN "MetodoPago"     mp ON mp.id = d."IdMetodoPago"
LEFT JOIN "SistemaUsuario" su ON su.id = d."IdUsuarioCreacion"
LEFT JOIN "SistemaUsuario" sm ON sm.id = d."IdUsuarioModificacion";

COMMENT ON VIEW v_documento IS
  'Documento con nombres de sus joins (NomCliente/NomMetodoPago/NomUsuarioCreacion/NomUsuarioModificacion/NomTipoDoc). Sin filtros ni orden: los pone el consumidor.';

GRANT SELECT ON v_documento TO anon, authenticated;
