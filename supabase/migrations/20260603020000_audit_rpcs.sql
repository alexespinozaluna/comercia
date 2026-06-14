-- =====================================================================
-- AUDITORÍA EN RPCs — leer IdUsuarioCreacion/Modificacion + FechaModificacion
-- desde el payload JSON (guardar_venta_con_items, modificar_abono).
-- registrar_abono mantiene p_id_usuario como parámetro porque construye
-- los documentos internamente (no recibe JSON natural).
--
-- Idempotente.
-- Base: docs/plan-auditoria-columnas.md (Fase 5)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. guardar_venta_con_items
--    Nueva firma SIN p_id_usuario_creacion: el audit viaja en el JSON.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.guardar_venta_con_items(BIGINT, JSONB, JSONB, BIGINT[], JSONB[], JSONB[], INT, INT, BIGINT);

CREATE OR REPLACE FUNCTION public.guardar_venta_con_items(
  p_id_documento    BIGINT,
  p_documento       JSONB,
  p_items           JSONB,
  p_items_to_delete BIGINT[],
  p_items_to_update JSONB[],
  p_items_to_add    JSONB[],
  p_id_tenant       INT,
  p_id_negocio      BIGINT DEFAULT NULL
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
    SELECT COALESCE(SUM((item->>'Total')::numeric), 0)
    INTO v_suma_items
    FROM jsonb_array_elements(p_items) AS item;
  ELSE
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
      "IdTipoDocumento", "Saldo", "IdMetodoPago", "IdTenant", "IdNegocio", "Estado",
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
      p_id_negocio,
      1,
      NULLIF((p_documento->>'IdUsuarioCreacion')::TEXT, '')::BIGINT,
      NOW()
    ) RETURNING id INTO v_doc_id;

    INSERT INTO "DocumentoItem" (
      "IdProducto", "Descripcion", "Cantidad", "PrecioVenta",
      "MontoAbono", "Total", "IdDocumento", "IdDocumentoRef",
      "IdTenant", "IdNegocio", "Estado",
      "IdUsuarioCreacion"
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
      p_id_negocio,
      1,
      NULLIF(item->>'IdUsuarioCreacion', '')::BIGINT
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
      "FechaEmision"          = (p_documento->>'FechaEmision')::date,
      "Descripcion"           = p_documento->>'Descripcion',
      "Concepto"              = p_documento->>'Concepto',
      "Total"                 = (p_documento->>'Total')::numeric,
      "bCredito"              = (p_documento->>'bCredito')::boolean,
      "IdCliente"             = (p_documento->>'IdCliente')::bigint,
      "IdClienteDireccion"    = (p_documento->>'IdClienteDireccion')::bigint,
      "DireccionEntrega"      = p_documento->>'DireccionEntrega',
      "IdTipoDocumento"       = (p_documento->>'IdTipoDocumento')::bigint,
      "Saldo"                 = (p_documento->>'Saldo')::numeric,
      "IdMetodoPago"          = (p_documento->>'IdMetodoPago')::bigint,
      "IdUsuarioModificacion" = NULLIF((p_documento->>'IdUsuarioModificacion')::TEXT, '')::BIGINT,
      "FechaModificacion"     = NULLIF(p_documento->>'FechaModificacion', '')::TIMESTAMPTZ
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
          "IdProducto"            = (v_item->>'IdProducto')::bigint,
          "Descripcion"           = v_item->>'Descripcion',
          "Cantidad"              = (v_item->>'Cantidad')::numeric,
          "PrecioVenta"           = (v_item->>'PrecioVenta')::numeric,
          "Total"                 = (v_item->>'Total')::numeric,
          "MontoAbono"            = (v_item->>'MontoAbono')::numeric,
          "IdDocumentoRef"        = (v_item->>'IdDocumentoRef')::bigint,
          "IdUsuarioModificacion" = NULLIF((v_item->>'IdUsuarioModificacion')::TEXT, '')::BIGINT,
          "FechaModificacion"     = NULLIF(v_item->>'FechaModificacion', '')::TIMESTAMPTZ
        WHERE id = (v_item->>'id')::bigint
          AND "IdDocumento" = p_id_documento
          AND "IdTenant" = p_id_tenant;
      END LOOP;
    END IF;

    IF p_items_to_add IS NOT NULL THEN
      FOREACH v_item IN ARRAY p_items_to_add LOOP
        INSERT INTO "DocumentoItem" (
          "IdDocumento", "IdTenant", "IdNegocio", "IdProducto", "Descripcion",
          "Cantidad", "PrecioVenta", "Total", "MontoAbono", "IdDocumentoRef",
          "IdUsuarioCreacion"
        ) VALUES (
          p_id_documento, p_id_tenant,
          COALESCE(p_id_negocio, (SELECT "IdNegocio" FROM "Documento" WHERE id = p_id_documento)),
          (v_item->>'IdProducto')::bigint,
          v_item->>'Descripcion',
          (v_item->>'Cantidad')::numeric,
          (v_item->>'PrecioVenta')::numeric,
          (v_item->>'Total')::numeric,
          COALESCE((v_item->>'MontoAbono')::numeric, 0),
          (v_item->>'IdDocumentoRef')::bigint,
          NULLIF((v_item->>'IdUsuarioCreacion')::TEXT, '')::BIGINT
        );
      END LOOP;
    END IF;

    RETURN jsonb_build_object('ok', true);

  END IF;

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

-- ---------------------------------------------------------------------
-- 2. modificar_abono — agrega p_id_usuario_modificacion para audit
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.modificar_abono(BIGINT, NUMERIC, DATE, TEXT, BIGINT, INT);

CREATE OR REPLACE FUNCTION public.modificar_abono(
  p_id_abono                BIGINT,
  p_monto                   NUMERIC,
  p_fecha                   DATE,
  p_concepto                TEXT,
  p_id_metodo_pago          BIGINT,
  p_id_tenant               INT,
  p_id_usuario_modificacion BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_n_items      INT;
  v_item_id      BIGINT;
  v_id_venta     BIGINT;
  v_venta_total  NUMERIC;
  v_cliente      TEXT;
  v_otros        NUMERIC;
  v_disponible   NUMERIC;
  v_pct          INT;
  v_concepto     TEXT;
  v_doc_concepto TEXT;
BEGIN
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor a cero';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "Documento"
    WHERE id = p_id_abono AND "IdTenant" = p_id_tenant
      AND "IdTipoDocumento" = 2 AND "Estado" = 1
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Abono no encontrado');
  END IF;

  SELECT COUNT(*) INTO v_n_items
  FROM "DocumentoItem"
  WHERE "IdDocumento" = p_id_abono AND "IdTenant" = p_id_tenant;

  IF v_n_items <> 1 THEN
    RAISE EXCEPTION 'Solo se pueden editar abonos de una sola deuda';
  END IF;

  SELECT id, "IdDocumentoRef" INTO v_item_id, v_id_venta
  FROM "DocumentoItem"
  WHERE "IdDocumento" = p_id_abono AND "IdTenant" = p_id_tenant
  LIMIT 1;

  IF v_id_venta IS NULL OR v_id_venta <= 0 THEN
    RAISE EXCEPTION 'El abono no referencia una venta válida';
  END IF;

  SELECT d."Total", c."Nombre"
  INTO v_venta_total, v_cliente
  FROM "Documento" d
  LEFT JOIN "Cliente" c ON c.id = d."IdCliente"
  WHERE d.id = v_id_venta AND d."IdTenant" = p_id_tenant
  FOR UPDATE OF d;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La venta referenciada no existe';
  END IF;

  SELECT COALESCE(SUM("MontoAbono"), 0) INTO v_otros
  FROM "DocumentoItem"
  WHERE "IdDocumentoRef" = v_id_venta
    AND "IdTenant" = p_id_tenant
    AND "IdDocumento" <> p_id_abono;

  v_disponible := v_venta_total - v_otros;

  IF p_monto > v_disponible + 0.01 THEN
    RAISE EXCEPTION 'El monto ingresado es mayor a la deuda';
  END IF;

  v_pct := COALESCE(ROUND(p_monto / NULLIF(v_venta_total, 0) * 100), 0);
  v_concepto := format(
    'Abono %s — Venta #%s (%s%%)',
    COALESCE(v_cliente, 'Cliente'),
    lpad(v_id_venta::text, 5, '0'),
    v_pct
  );
  v_doc_concepto := COALESCE(NULLIF(btrim(p_concepto), ''), v_concepto);

  UPDATE "Documento" SET
    "FechaEmision"          = p_fecha,
    "Concepto"              = v_doc_concepto,
    "Descripcion"           = v_concepto,
    "Total"                 = p_monto,
    "IdMetodoPago"          = NULLIF(p_id_metodo_pago, 0),
    "IdUsuarioModificacion" = p_id_usuario_modificacion,
    "FechaModificacion"     = NOW()
  WHERE id = p_id_abono AND "IdTenant" = p_id_tenant;

  UPDATE "DocumentoItem" SET
    "Cantidad"              = 1,
    "PrecioVenta"           = p_monto,
    "MontoAbono"            = p_monto,
    "Total"                 = p_monto,
    "Descripcion"           = v_concepto,
    "IdUsuarioModificacion" = p_id_usuario_modificacion,
    "FechaModificacion"     = NOW()
  WHERE id = v_item_id AND "IdTenant" = p_id_tenant;

  RETURN jsonb_build_object('ok', true, 'id_venta', v_id_venta);

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;
