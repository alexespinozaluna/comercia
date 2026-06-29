-- =====================================================================
-- DESCUENTO GLOBAL EN VENTA
-- =====================================================================
-- Añade a "Documento":
--   * "Importe"   = bruto = Σ(item.Total)            (siempre poblado)
--   * "Descuento" = monto del descuento (≥ 0)
-- y mantiene "Total" como el NETO = Importe − Descuento (lo que ya leen
-- Saldo, arqueo, reportes, deuda y abonos). El stock usa Cantidad → no se
-- ve afectado.
--
-- guardar_venta_con_items se redefine SOBRE la versión vigente (auditoría,
-- migración 20260603020000: firma de 8 args, el audit viaja en el JSON) para:
--   * calcular el bruto desde los items (fuente de verdad),
--   * validar  ABS(Importe − Descuento − Total) <= 0.01,
--   * persistir Importe/Descuento en INSERT y UPDATE.
--
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Columnas + backfill
-- ---------------------------------------------------------------------
ALTER TABLE "Documento" ADD COLUMN IF NOT EXISTS "Importe"   numeric NOT NULL DEFAULT 0;
ALTER TABLE "Documento" ADD COLUMN IF NOT EXISTS "Descuento" numeric NOT NULL DEFAULT 0;

-- Histórico: sin descuento, el bruto == neto. Guard idempotente: solo filas
-- cuyo Importe quedó en 0 por el DEFAULT (no toca ventas ya con descuento).
UPDATE "Documento" SET "Importe" = "Total"
WHERE "Importe" = 0 AND "Total" <> 0;

-- ---------------------------------------------------------------------
-- 2. guardar_venta_con_items (+ Importe / Descuento, conserva auditoría)
-- ---------------------------------------------------------------------
-- Elimina un overload erróneo de 9 args (con p_id_usuario_creacion) por si una
-- versión previa de esta migración lo creó: dejaría dos funciones y PostgREST
-- llamaría a la que no lleva descuento.
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
  v_importe     NUMERIC;   -- bruto = Σ(item.Total)
  v_descuento   NUMERIC;   -- monto del descuento
  v_total       NUMERIC;   -- neto = Importe − Descuento
  v_item        JSONB;
BEGIN
  -- ── Bruto desde los items (fuente de verdad) ───────────────
  IF p_id_documento IS NULL OR p_id_documento = 0 THEN
    SELECT COALESCE(SUM((item->>'Total')::numeric), 0)
    INTO v_importe
    FROM jsonb_array_elements(p_items) AS item;
  ELSE
    SELECT
      COALESCE((SELECT SUM((item->>'Total')::numeric) FROM unnest(p_items_to_add) AS item), 0) +
      COALESCE((SELECT SUM((item->>'Total')::numeric) FROM unnest(p_items_to_update) AS item), 0)
    INTO v_importe;
  END IF;

  v_descuento := COALESCE((p_documento->>'Descuento')::numeric, 0);
  v_total     := (p_documento->>'Total')::numeric;

  -- ── Validación: neto = bruto − descuento ───────────────────
  IF v_descuento < 0 OR v_descuento > v_importe + 0.01 THEN
    RAISE EXCEPTION 'Descuento invalido: descuento=% importe=%', v_descuento, v_importe;
  END IF;

  IF ABS(v_importe - v_descuento - v_total) > 0.01 THEN
    RAISE EXCEPTION 'Descuadre de totales: importe=% descuento=% total=%',
      v_importe, v_descuento, v_total;
  END IF;

  -- ── CREAR ─────────────────────────────────────────────────
  IF p_id_documento IS NULL OR p_id_documento = 0 THEN

    INSERT INTO "Documento" (
      "FechaEmision", "Descripcion", "Concepto", "Importe", "Descuento", "Total", "bCredito",
      "IdCliente", "IdClienteDireccion", "DireccionEntrega", "TotalAbono",
      "IdTipoDocumento", "Saldo", "IdMetodoPago", "IdTenant", "IdNegocio", "Estado",
      "IdUsuarioCreacion", "FechaCreacion"
    ) VALUES (
      (p_documento->>'FechaEmision')::TIMESTAMP,
      p_documento->>'Descripcion',
      p_documento->>'Concepto',
      v_importe,
      v_descuento,
      v_total,
      (p_documento->>'bCredito')::BOOLEAN,
      NULLIF((p_documento->>'IdCliente')::INTEGER, 0),
      NULLIF((p_documento->>'IdClienteDireccion')::TEXT, '')::INTEGER,
      NULLIF(p_documento->>'DireccionEntrega', ''),
      0,
      COALESCE((p_documento->>'IdTipoDocumento')::INTEGER, 1),
      CASE
        WHEN (p_documento->>'bCredito')::BOOLEAN THEN v_total
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
      "Importe"               = v_importe,
      "Descuento"             = v_descuento,
      "Total"                 = v_total,
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
