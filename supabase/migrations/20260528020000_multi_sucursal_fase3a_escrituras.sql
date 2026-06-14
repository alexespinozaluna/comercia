-- =====================================================================
-- MULTI-SUCURSAL — FASE 3a: las escrituras pueblan IdNegocio
-- =====================================================================
-- Hace que toda fila nueva lleve IdNegocio. NO cambia el origen del stock
-- (sigue siendo Producto.Cantidad; el cutover a ProductoStock es la 3b).
-- NO filtra lecturas (3c) ni re-aplica NOT NULL (3d).
--
-- Cambios:
--   * guardar_venta_con_items  → nuevo p_id_negocio; lo pone en Documento e items.
--   * registrar_abono          → nuevo p_id_negocio; el abono hereda el negocio
--                                de la deuda y el FIFO se acota a esa sucursal
--                                (deuda por sucursal). Guard: si p_id_negocio es
--                                NULL no filtra (compatibilidad con tokens viejos).
--   * fn_registrar_movimiento_stock → ProductoMovimiento.IdNegocio = NEW.IdNegocio.
--   * Índice único de caja → de (IdTenant) a (IdTenant, IdNegocio): una caja
--     abierta por SUCURSAL.
--
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. guardar_venta_con_items (+ p_id_negocio)
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.guardar_venta_con_items(BIGINT, JSONB, JSONB, BIGINT[], JSONB[], JSONB[], INT, INT);

CREATE OR REPLACE FUNCTION public.guardar_venta_con_items(
  p_id_documento        BIGINT,
  p_documento           JSONB,
  p_items               JSONB,
  p_items_to_delete     BIGINT[],
  p_items_to_update     JSONB[],
  p_items_to_add        JSONB[],
  p_id_tenant           INT,
  p_id_usuario_creacion INT,
  p_id_negocio          BIGINT DEFAULT NULL
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
      p_id_usuario_creacion,
      NOW()
    ) RETURNING id INTO v_doc_id;

    INSERT INTO "DocumentoItem" (
      "IdProducto", "Descripcion", "Cantidad", "PrecioVenta",
      "MontoAbono", "Total", "IdDocumento", "IdDocumentoRef",
      "IdTenant", "IdNegocio", "Estado"
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
          "IdDocumento", "IdTenant", "IdNegocio", "IdProducto", "Descripcion",
          "Cantidad", "PrecioVenta", "Total", "MontoAbono", "IdDocumentoRef"
        ) VALUES (
          p_id_documento, p_id_tenant,
          COALESCE(p_id_negocio, (SELECT "IdNegocio" FROM "Documento" WHERE id = p_id_documento)),
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

-- ---------------------------------------------------------------------
-- 2. registrar_abono (+ p_id_negocio; deuda por sucursal)
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.registrar_abono(INT, BIGINT, NUMERIC, DATE, TEXT, BIGINT, INT, INT);

CREATE OR REPLACE FUNCTION public.registrar_abono(
  p_tipo            INT,
  p_id             BIGINT,
  p_monto           NUMERIC,
  p_fecha           DATE,
  p_concepto        TEXT,
  p_id_metodo_pago  BIGINT,
  p_id_tenant       INT,
  p_id_usuario      INT,
  p_id_negocio      BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_restante    NUMERIC := p_monto;
  v_suma_saldo  NUMERIC;
  v_abonar      NUMERIC;
  v_pct         INT;
  v_concepto    TEXT;
  v_doc_concepto TEXT;
  v_doc_id      BIGINT;
  v_abonos      BIGINT[] := '{}';
  v_deuda       RECORD;
BEGIN
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor a cero';
  END IF;

  -- Bloquear las deudas relevantes (de la sucursal activa si se indicó)
  PERFORM 1
  FROM "Documento" d
  WHERE d."IdTenant" = p_id_tenant
    AND d."bCredito" = true
    AND d."Saldo" > 0
    AND d."Estado" = 1
    AND (p_id_negocio IS NULL OR d."IdNegocio" = p_id_negocio)
    AND ( (p_tipo = 1 AND d.id = p_id)
       OR (p_tipo = 2 AND d."IdCliente" = p_id) )
  FOR UPDATE;

  SELECT COALESCE(SUM(d."Saldo"), 0)
  INTO v_suma_saldo
  FROM "Documento" d
  WHERE d."IdTenant" = p_id_tenant
    AND d."bCredito" = true
    AND d."Saldo" > 0
    AND d."Estado" = 1
    AND (p_id_negocio IS NULL OR d."IdNegocio" = p_id_negocio)
    AND ( (p_tipo = 1 AND d.id = p_id)
       OR (p_tipo = 2 AND d."IdCliente" = p_id) );

  IF p_monto > v_suma_saldo + 0.01 THEN
    RAISE EXCEPTION 'El monto ingresado es mayor a la deuda';
  END IF;

  FOR v_deuda IN
    SELECT d.id, d."Total", d."Saldo", d."IdCliente", d."DireccionEntrega",
           d."IdNegocio", c."Nombre" AS cliente_nombre
    FROM "Documento" d
    LEFT JOIN "Cliente" c ON c.id = d."IdCliente"
    WHERE d."IdTenant" = p_id_tenant
      AND d."bCredito" = true
      AND d."Saldo" > 0
      AND d."Estado" = 1
      AND (p_id_negocio IS NULL OR d."IdNegocio" = p_id_negocio)
      AND ( (p_tipo = 1 AND d.id = p_id)
         OR (p_tipo = 2 AND d."IdCliente" = p_id) )
    ORDER BY d."FechaEmision" ASC, d.id ASC
  LOOP
    EXIT WHEN v_restante <= 0;

    v_abonar := LEAST(v_restante, v_deuda."Saldo");

    v_pct := COALESCE(ROUND(v_abonar / NULLIF(v_deuda."Total", 0) * 100), 0);
    v_concepto := format(
      'Abono %s — Venta #%s (%s%%)',
      COALESCE(v_deuda.cliente_nombre, 'Cliente'),
      lpad(v_deuda.id::text, 5, '0'),
      v_pct
    );
    v_doc_concepto := COALESCE(NULLIF(btrim(p_concepto), ''), v_concepto);

    INSERT INTO "Documento" (
      "FechaEmision", "Descripcion", "Concepto", "Total", "bCredito",
      "IdCliente", "IdClienteDireccion", "DireccionEntrega", "TotalAbono",
      "IdTipoDocumento", "Saldo", "IdMetodoPago", "IdTenant", "IdNegocio", "Estado",
      "IdUsuarioCreacion", "FechaCreacion"
    ) VALUES (
      p_fecha,
      v_concepto,
      v_doc_concepto,
      v_abonar,
      false,
      v_deuda."IdCliente",
      NULL,
      NULL,
      0,
      2,
      0,
      NULLIF(p_id_metodo_pago, 0),
      p_id_tenant,
      COALESCE(p_id_negocio, v_deuda."IdNegocio"),
      1,
      p_id_usuario,
      NOW()
    ) RETURNING id INTO v_doc_id;

    INSERT INTO "DocumentoItem" (
      "IdProducto", "Descripcion", "Cantidad", "PrecioVenta",
      "MontoAbono", "Total", "IdDocumento", "IdDocumentoRef",
      "IdTenant", "IdNegocio", "Estado"
    ) VALUES (
      0,
      v_concepto,
      1,
      v_abonar,
      v_abonar,
      v_abonar,
      v_doc_id,
      v_deuda.id,
      p_id_tenant,
      COALESCE(p_id_negocio, v_deuda."IdNegocio"),
      1
    );

    v_abonos := array_append(v_abonos, v_doc_id);
    v_restante := v_restante - v_abonar;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'abonos', to_jsonb(v_abonos),
    'no_distribuido', v_restante
  );

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

-- ---------------------------------------------------------------------
-- 3. Trigger de stock: ProductoMovimiento hereda IdNegocio del item
--    (sigue actualizando Producto.Cantidad; el cutover a ProductoStock
--    es la Fase 3b)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_registrar_movimiento_stock()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW."IdDocumento" IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM "Documento"
            WHERE id = NEW."IdDocumento"
            AND "IdTipoDocumento" = 1
            AND "Estado" = 1
        ) THEN
            INSERT INTO "ProductoMovimiento" (
                "IdTenant", "IdNegocio", "IdProducto", "TipoMovimiento", "Cantidad",
                "StockAnterior", "StockNuevo", "IdDocumento", "Fecha"
            )
            SELECT
                NEW."IdTenant",
                NEW."IdNegocio",
                NEW."IdProducto",
                2,
                NEW."Cantidad",
                p."Cantidad",
                p."Cantidad" - NEW."Cantidad",
                NEW."IdDocumento",
                NOW()
            FROM "Producto" p WHERE p.id = NEW."IdProducto";

            UPDATE "Producto"
            SET "Cantidad" = "Cantidad" - NEW."Cantidad"
            WHERE id = NEW."IdProducto";
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 4. Caja: una caja abierta por SUCURSAL (antes era por tenant)
-- ---------------------------------------------------------------------
DROP INDEX IF EXISTS "UX_Caja_AbiertaPorTenant";
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Caja_AbiertaPorNegocio"
  ON "Caja"("IdTenant", "IdNegocio") WHERE "Estado" = 1;
