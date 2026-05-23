-- =============================================================
-- RPC functions for atomic venta operations
-- Execute this script in Supabase SQL Editor
-- =============================================================

-- 1. crear_venta_con_items: Insert a Documento + DocumentoItem[] atomically
--    Returns the created Documento row as JSONB
CREATE OR REPLACE FUNCTION crear_venta_con_items(
  p_documento JSONB,
  p_items JSONB,
  p_id_tenant INTEGER,
  p_id_usuario_creacion INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_doc_id INTEGER;
  v_result JSONB;
BEGIN
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


-- 2. modificar_venta_con_items: Update a Documento and sync its items atomically
--    p_items_to_soft_delete: array of item IDs to soft-delete (Estado = 0)
--    p_items_to_update: JSONB array of items to update (must have 'id' field)
--    p_items_to_add: JSONB array of new items to insert (no 'id' or id = 0)
--    Returns JSONB with ok: true or error message
CREATE OR REPLACE FUNCTION modificar_venta_con_items(
  p_id_documento INTEGER,
  p_documento JSONB,
  p_items_to_soft_delete JSONB,
  p_items_to_update JSONB,
  p_items_to_add JSONB,
  p_id_tenant INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Verify ownership and active status
  SELECT COUNT(*) INTO v_count
  FROM "Documento"
  WHERE id = p_id_documento AND "IdTenant" = p_id_tenant AND "Estado" = 1;

  IF v_count = 0 THEN
    RETURN jsonb_build_object('error', 'Documento no encontrado');
  END IF;

  -- Update parent Documento
  UPDATE "Documento" SET
    "FechaEmision" = (p_documento->>'FechaEmision')::TIMESTAMP,
    "Descripcion" = NULLIF(p_documento->>'Descripcion', ''),
    "Concepto" = NULLIF(p_documento->>'Concepto', ''),
    "Total" = (p_documento->>'Total')::NUMERIC,
    "bCredito" = (p_documento->>'bCredito')::BOOLEAN,
    "IdCliente" = NULLIF((p_documento->>'IdCliente')::INTEGER, 0),
    "IdClienteDireccion" = NULLIF((p_documento->>'IdClienteDireccion')::INTEGER, 0),
    "DireccionEntrega" = NULLIF(p_documento->>'DireccionEntrega', ''),
    "Saldo" = CASE
      WHEN (p_documento->>'bCredito')::BOOLEAN THEN (p_documento->>'Total')::NUMERIC
      ELSE 0
    END,
    "IdMetodoPago" = NULLIF((p_documento->>'IdMetodoPago')::INTEGER, 0)
  WHERE id = p_id_documento AND "IdTenant" = p_id_tenant;

  -- Soft-delete removed items
  IF p_items_to_soft_delete IS NOT NULL THEN
    UPDATE "DocumentoItem" SET "Estado" = 0
    WHERE "IdDocumento" = p_id_documento
      AND "IdTenant" = p_id_tenant
      AND "Estado" = 1
      AND id = ANY(
        SELECT (item)::INTEGER FROM jsonb_array_elements(p_items_to_soft_delete) AS item
      );
  END IF;

  -- Update existing items
  IF p_items_to_update IS NOT NULL THEN
    UPDATE "DocumentoItem" di SET
      "IdProducto" = (u->>'IdProducto')::INTEGER,
      "Descripcion" = u->>'Descripcion',
      "Cantidad" = (u->>'Cantidad')::NUMERIC,
      "PrecioVenta" = (u->>'PrecioVenta')::NUMERIC,
      "MontoAbono" = COALESCE((u->>'MontoAbono')::NUMERIC, 0),
      "Total" = COALESCE(
        NULLIF(u->>'Total', '')::NUMERIC,
        (u->>'Cantidad')::NUMERIC * (u->>'PrecioVenta')::NUMERIC
      ),
      "IdDocumentoRef" = NULLIF(u->>'IdDocumentoRef', '')::INTEGER
    FROM jsonb_array_elements(p_items_to_update) AS u
    WHERE di.id = (u->>'id')::INTEGER
      AND di."IdTenant" = p_id_tenant;
  END IF;

  -- Insert new items
  IF p_items_to_add IS NOT NULL THEN
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
      p_id_documento,
      NULLIF(item->>'IdDocumentoRef', '')::INTEGER,
      p_id_tenant,
      1
    FROM jsonb_array_elements(p_items_to_add) AS item;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql;