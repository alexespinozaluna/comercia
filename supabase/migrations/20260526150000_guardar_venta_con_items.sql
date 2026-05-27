-- =============================================================
-- Unifica crear_venta_con_items + modificar_venta_con_items en una
-- sola funcion guardar_venta_con_items.
--   p_id_documento NULL o 0  => crear (items en p_items)
--   p_id_documento > 0       => modificar (diff en delete/update/add)
-- Toda la operacion corre en una unica transaccion implicita.
-- =============================================================

-- Eliminar funciones anteriores
DROP FUNCTION IF EXISTS public.crear_venta_con_items(JSONB, JSONB, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.modificar_venta_con_items(BIGINT, JSONB, BIGINT[], JSONB[], JSONB[], INT);

CREATE OR REPLACE FUNCTION public.guardar_venta_con_items(
  p_id_documento        BIGINT,   -- NULL o 0 = crear, > 0 = modificar
  p_documento           JSONB,
  p_items               JSONB,    -- items completos (usado al crear)
  p_items_to_delete     BIGINT[], -- ids a eliminar (usado al modificar)
  p_items_to_update     JSONB[],  -- items existentes con id (usado al modificar)
  p_items_to_add        JSONB[],  -- items nuevos sin id (usado al modificar)
  p_id_tenant           INT,
  p_id_usuario_creacion INT       -- solo usado al crear
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_doc_id      BIGINT;
  v_result      JSONB;
  v_suma_items  NUMERIC;
  v_item        JSONB;
BEGIN

  -- ── Validación de totales ──────────────────────────────────
  IF p_id_documento IS NULL OR p_id_documento = 0 THEN
    -- crear: items vienen en p_items (JSONB array)
    SELECT COALESCE(SUM((item->>'Total')::numeric), 0)
    INTO v_suma_items
    FROM jsonb_array_elements(p_items) AS item;
  ELSE
    -- modificar: suma de add + update
    SELECT
      COALESCE((SELECT SUM((item->>'Total')::numeric) FROM unnest(p_items_to_add) AS item), 0) +
      COALESCE((SELECT SUM((item->>'Total')::numeric) FROM unnest(p_items_to_update) AS item), 0)
    INTO v_suma_items;
  END IF;

  IF ABS(v_suma_items - (p_documento->>'Total')::numeric) > 0.01 THEN
    RAISE EXCEPTION 'Descuadre de totales: items=% documento=%',
      v_suma_items, (p_documento->>'Total')::numeric;
  END IF;

  -- ── CREAR ─────────────────────────────────────────────────
  IF p_id_documento IS NULL OR p_id_documento = 0 THEN

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
      COALESCE(NULLIF(item->>'Total', '')::NUMERIC,
        (item->>'Cantidad')::NUMERIC * (item->>'PrecioVenta')::NUMERIC),
      v_doc_id,
      NULLIF(item->>'IdDocumentoRef', '')::INTEGER,
      p_id_tenant,
      1
    FROM jsonb_array_elements(p_items) AS item;

    SELECT to_jsonb(d.*) FROM "Documento" d WHERE d.id = v_doc_id INTO v_result;
    RETURN v_result;

  -- ── MODIFICAR ─────────────────────────────────────────────
  ELSE

    IF NOT EXISTS (
      SELECT 1 FROM "Documento"
      WHERE id = p_id_documento AND "IdTenant" = p_id_tenant AND "Estado" = 1
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Documento no encontrado');
    END IF;

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

    IF p_items_to_delete IS NOT NULL AND array_length(p_items_to_delete, 1) > 0 THEN
      DELETE FROM "DocumentoItem"
      WHERE id = ANY(p_items_to_delete)
        AND "IdDocumento" = p_id_documento
        AND "IdTenant" = p_id_tenant;
    END IF;

    IF p_items_to_update IS NOT NULL THEN
      FOREACH v_item IN ARRAY p_items_to_update LOOP
        UPDATE "DocumentoItem" SET
          "IdProducto"     = (v_item->>'IdProducto')::bigint,
          "Descripcion"    = v_item->>'Descripcion',
          "Cantidad"       = (v_item->>'Cantidad')::numeric,
          "PrecioVenta"    = (v_item->>'PrecioVenta')::numeric,
          "Total"          = (v_item->>'Total')::numeric,
          "MontoAbono"     = (v_item->>'MontoAbono')::numeric,
          "IdDocumentoRef" = (v_item->>'IdDocumentoRef')::bigint
        WHERE id = (v_item->>'id')::bigint
          AND "IdDocumento" = p_id_documento
          AND "IdTenant" = p_id_tenant;
      END LOOP;
    END IF;

    IF p_items_to_add IS NOT NULL THEN
      FOREACH v_item IN ARRAY p_items_to_add LOOP
        INSERT INTO "DocumentoItem" (
          "IdDocumento", "IdTenant", "IdProducto", "Descripcion",
          "Cantidad", "PrecioVenta", "Total", "MontoAbono", "IdDocumentoRef"
        ) VALUES (
          p_id_documento, p_id_tenant,
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

  END IF;

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;
