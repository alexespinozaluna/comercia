-- =============================================================
-- Validacion de integridad: el total del documento debe cuadrar
-- con la suma de los Total de sus items (tolerancia 0.01).
--
-- Se reemplazan COMPLETAS ambas funciones (no se puede parchear solo
-- el cuerpo) agregando el chequeo ANTES de cualquier INSERT/UPDATE.
-- Ningun otro comportamiento cambia respecto de las versiones previas
-- (crear: docs/supabase-rpc-ventas.sql; modificar: migracion 20260526120000).
--
-- Nota de tipos:
--   crear_venta_con_items  -> p_items es JSONB  => se itera con jsonb_array_elements()
--                             (unnest() solo aplica a arrays SQL, no a un valor JSONB).
--   modificar_venta_con_items -> p_items_to_add / p_items_to_update son JSONB[]
--                             => se iteran con unnest().
-- =============================================================

-- -------------------------------------------------------------
-- 1. crear_venta_con_items
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION crear_venta_con_items(
  p_documento JSONB,
  p_items JSONB,
  p_id_tenant INTEGER,
  p_id_usuario_creacion INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_doc_id INTEGER;
  v_result JSONB;
  v_suma_items NUMERIC;
BEGIN
  -- Validar que la suma de items cuadre con el total del documento
  SELECT COALESCE(SUM((item->>'Total')::numeric), 0)
  INTO v_suma_items
  FROM jsonb_array_elements(p_items) AS item;

  IF ABS(v_suma_items - (p_documento->>'Total')::numeric) > 0.01 THEN
    RAISE EXCEPTION 'Descuadre de totales: items=% documento=%',
      v_suma_items,
      (p_documento->>'Total')::numeric;
  END IF;

  -- Insert parent Documento
  INSERT INTO "Documento" (
    "FechaEmision", "Descripcion", "Concepto", "Total", "bCredito",
    "IdCliente", "IdClienteDireccion", "DireccionEntrega", "TotalAbono",
    "IdTipoDocumento", "Saldo", "IdMetodoPago", "IdTenant", "Estado",
    "IdUsuarioCreacion", "FechaCreacion"
  ) VALUES (
    (p_documento->>'FechaEmision')::TIMESTAMP,
    p_documento->>'Descripcion',
    p_documento->>'Concepto',
    (p_documento->>'Total')::NUMERIC,
    (p_documento->>'bCredito')::BOOLEAN,
    NULLIF((p_documento->>'IdCliente')::INTEGER, 0),
    NULLIF((p_documento->>'IdClienteDireccion')::TEXT, '')::INTEGER,
    NULLIF(p_documento->>'DireccionEntrega', ''),
    0,
    COALESCE((p_documento->>'IdTipoDocumento')::INTEGER, 1),
    CASE
      WHEN (p_documento->>'bCredito')::BOOLEAN THEN (p_documento->>'Total')::NUMERIC
      ELSE 0
    END,
    NULLIF((p_documento->>'IdMetodoPago')::TEXT, '')::INTEGER,
    p_id_tenant,
    1,
    p_id_usuario_creacion,
    NOW()
  ) RETURNING id INTO v_doc_id;

  -- Insert DocumentoItem rows
  INSERT INTO "DocumentoItem" (
    "IdProducto", "Descripcion", "Cantidad", "PrecioVenta",
    "MontoAbono", "Total", "IdDocumento", "IdDocumentoRef",
    "IdTenant", "Estado"
  )
  SELECT
    (item->>'IdProducto')::INTEGER,
    item->>'Descripcion',
    (item->>'Cantidad')::NUMERIC,
    (item->>'PrecioVenta')::NUMERIC,
    COALESCE((item->>'MontoAbono')::NUMERIC, 0),
    COALESCE(
      NULLIF(item->>'Total', '')::NUMERIC,
      (item->>'Cantidad')::NUMERIC * (item->>'PrecioVenta')::NUMERIC
    ),
    v_doc_id,
    NULLIF(item->>'IdDocumentoRef', '')::INTEGER,
    p_id_tenant,
    1
  FROM jsonb_array_elements(p_items) AS item;

  -- Return the created document
  SELECT to_jsonb(d.*) FROM "Documento" d WHERE d.id = v_doc_id INTO v_result;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;


-- -------------------------------------------------------------
-- 2. modificar_venta_con_items
-- -------------------------------------------------------------
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
  v_suma_items NUMERIC;
BEGIN
  -- Verificar que el documento existe y pertenece al tenant
  IF NOT EXISTS (
    SELECT 1 FROM "Documento"
    WHERE id = p_id_documento AND "IdTenant" = p_id_tenant AND "Estado" = 1
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Documento no encontrado');
  END IF;

  -- Validar que la suma combinada (add + update) cuadre con el total del documento
  SELECT
    COALESCE((SELECT SUM((item->>'Total')::numeric) FROM unnest(p_items_to_add) AS item), 0) +
    COALESCE((SELECT SUM((item->>'Total')::numeric) FROM unnest(p_items_to_update) AS item), 0)
  INTO v_suma_items;

  IF ABS(v_suma_items - (p_documento->>'Total')::numeric) > 0.01 THEN
    RAISE EXCEPTION 'Descuadre de totales: items=% documento=%',
      v_suma_items,
      (p_documento->>'Total')::numeric;
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
