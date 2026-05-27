-- =============================================================
-- modificar_venta_con_items: actualiza un Documento y sincroniza
-- sus DocumentoItem de forma ATÓMICA dentro de una sola transacción.
--
-- El diff (delete / update / insert) se calcula en el servidor Next.js
-- y se pasa COMPLETO en una única llamada RPC. Cualquier error dentro
-- de la función provoca el rollback automático de todo el bloque.
--
-- Reemplaza la versión anterior (soft-delete vía JSONB) que calculaba
-- el diff con un SELECT fuera de transacción. Se hace DROP explícito de
-- la firma vieja porque la nueva tiene tipos de parámetros distintos
-- (BIGINT[]/JSONB[]) y CREATE OR REPLACE crearía una sobrecarga ambigua
-- en lugar de reemplazarla.
-- =============================================================

DROP FUNCTION IF EXISTS public.modificar_venta_con_items(
  INTEGER, JSONB, JSONB, JSONB, JSONB, INTEGER
);

CREATE OR REPLACE FUNCTION public.modificar_venta_con_items(
  p_id_documento     BIGINT,
  p_documento        JSONB,
  p_items_to_delete  BIGINT[],       -- ids a eliminar (hard delete)
  p_items_to_update  JSONB[],        -- items existentes con id + campos
  p_items_to_add     JSONB[],        -- items nuevos sin id
  p_id_tenant        INT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_item JSONB;
BEGIN
  -- Verificar que el documento existe y pertenece al tenant
  IF NOT EXISTS (
    SELECT 1 FROM "Documento"
    WHERE id = p_id_documento AND "IdTenant" = p_id_tenant AND "Estado" = 1
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Documento no encontrado');
  END IF;

  -- UPDATE Documento
  UPDATE "Documento" SET
    "FechaEmision"       = (p_documento->>'FechaEmision')::date,
    "Descripcion"        = p_documento->>'Descripcion',
    "Concepto"           = p_documento->>'Concepto',
    "Total"              = (p_documento->>'Total')::numeric,
    "bCredito"           = (p_documento->>'bCredito')::boolean,
    "IdCliente"          = (p_documento->>'IdCliente')::bigint,
    "IdClienteDireccion" = (p_documento->>'IdClienteDireccion')::bigint,
    "DireccionEntrega"   = p_documento->>'DireccionEntrega',
    "IdTipoDocumento"    = (p_documento->>'IdTipoDocumento')::bigint,
    "Saldo"              = (p_documento->>'Saldo')::numeric,
    "IdMetodoPago"       = (p_documento->>'IdMetodoPago')::bigint
  WHERE id = p_id_documento AND "IdTenant" = p_id_tenant;

  -- DELETE items
  IF p_items_to_delete IS NOT NULL AND array_length(p_items_to_delete, 1) > 0 THEN
    DELETE FROM "DocumentoItem"
    WHERE id = ANY(p_items_to_delete)
      AND "IdDocumento" = p_id_documento
      AND "IdTenant" = p_id_tenant;
  END IF;

  -- UPDATE items existentes
  IF p_items_to_update IS NOT NULL THEN
    FOREACH v_item IN ARRAY p_items_to_update LOOP
      UPDATE "DocumentoItem" SET
        "IdProducto"   = (v_item->>'IdProducto')::bigint,
        "Descripcion"  = v_item->>'Descripcion',
        "Cantidad"     = (v_item->>'Cantidad')::numeric,
        "PrecioVenta"  = (v_item->>'PrecioVenta')::numeric,
        "Total"        = (v_item->>'Total')::numeric,
        "MontoAbono"   = (v_item->>'MontoAbono')::numeric,
        "IdDocumentoRef" = (v_item->>'IdDocumentoRef')::bigint
      WHERE id = (v_item->>'id')::bigint
        AND "IdDocumento" = p_id_documento
        AND "IdTenant" = p_id_tenant;
    END LOOP;
  END IF;

  -- INSERT items nuevos
  IF p_items_to_add IS NOT NULL THEN
    FOREACH v_item IN ARRAY p_items_to_add LOOP
      INSERT INTO "DocumentoItem" (
        "IdDocumento", "IdTenant", "IdProducto", "Descripcion",
        "Cantidad", "PrecioVenta", "Total", "MontoAbono", "IdDocumentoRef"
      ) VALUES (
        p_id_documento,
        p_id_tenant,
        (v_item->>'IdProducto')::bigint,
        v_item->>'Descripcion',
        (v_item->>'Cantidad')::numeric,
        (v_item->>'PrecioVenta')::numeric,
        (v_item->>'Total')::numeric,
        COALESCE((v_item->>'MontoAbono')::numeric, 0),
        (v_item->>'IdDocumentoRef')::bigint
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object('ok', true);

EXCEPTION WHEN OTHERS THEN
  RAISE; -- deja que PostgreSQL haga rollback automático
END;
$$;
