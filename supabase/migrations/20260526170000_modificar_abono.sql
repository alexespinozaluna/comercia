-- =============================================================
-- modificar_abono: edita un abono existente (IdTipoDocumento=2) de forma
-- ATÓMICA. Solo aplica a abonos de UNA sola deuda (1 item), que es el
-- modelo que genera registrar_abono (relación 1:1 abono↔venta).
--
--   p_id_abono        → Documento del abono a editar
--   p_monto           → nuevo monto del abono
--
-- Regla de validación:
--   disponible = Total de la venta − abonos de OTROS documentos a esa venta
--   (equivale a: Saldo actual de la venta + lo que este abono ya aportaba)
--   Se exige p_monto ≤ disponible.
--
-- Tras actualizar el item, el trigger trg_actualizar_saldo_total_abono
-- recalcula Saldo/TotalAbono de la venta referenciada. Todo en una
-- transacción: si algo falla, rollback.
-- =============================================================

CREATE OR REPLACE FUNCTION public.modificar_abono(
  p_id_abono        BIGINT,
  p_monto           NUMERIC,
  p_fecha           DATE,
  p_concepto        TEXT,
  p_id_metodo_pago  BIGINT,
  p_id_tenant       INT
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

  -- El abono debe existir, ser tipo 2 y del tenant
  IF NOT EXISTS (
    SELECT 1 FROM "Documento"
    WHERE id = p_id_abono AND "IdTenant" = p_id_tenant
      AND "IdTipoDocumento" = 2 AND "Estado" = 1
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Abono no encontrado');
  END IF;

  -- Debe tener exactamente un item (modelo 1 abono : 1 deuda)
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

  -- Bloquear la venta referenciada y leer su total + cliente
  SELECT d."Total", c."Nombre"
  INTO v_venta_total, v_cliente
  FROM "Documento" d
  LEFT JOIN "Cliente" c ON c.id = d."IdCliente"
  WHERE d.id = v_id_venta AND d."IdTenant" = p_id_tenant
  FOR UPDATE OF d;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La venta referenciada no existe';
  END IF;

  -- Disponible = Total de la venta − abonos de OTROS documentos a esa venta
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
    "FechaEmision" = p_fecha,
    "Concepto"     = v_doc_concepto,
    "Descripcion"  = v_concepto,
    "Total"        = p_monto,
    "IdMetodoPago" = NULLIF(p_id_metodo_pago, 0)
  WHERE id = p_id_abono AND "IdTenant" = p_id_tenant;

  UPDATE "DocumentoItem" SET
    "Cantidad"    = 1,
    "PrecioVenta" = p_monto,
    "MontoAbono"  = p_monto,
    "Total"       = p_monto,
    "Descripcion" = v_concepto
  WHERE id = v_item_id AND "IdTenant" = p_id_tenant;
  -- el trigger recalcula Saldo/TotalAbono de la venta referenciada

  RETURN jsonb_build_object('ok', true, 'id_venta', v_id_venta);

EXCEPTION WHEN OTHERS THEN
  RAISE; -- rollback automático
END;
$$;
