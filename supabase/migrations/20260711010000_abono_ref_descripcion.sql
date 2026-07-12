-- =============================================================
-- Descripción de ítem de abono → formato "Ref" con fecha de la venta.
-- (Propuesta 2026-07-11, Opción 1: texto horneado en el RPC.)
--
-- ANTES: 'Abono {Cliente} — Venta #00042 (50%)'
-- AHORA: 'Ref: 05/07/25 · Venta #00042 (50%)'
--        donde la fecha es la FechaEmision de la VENTA referenciada, el
--        número es su id (zero-pad 5) y el % es MontoAbono / venta.Total.
--
-- El nombre del cliente sale del ítem: en el detalle del abono ya aparece
-- en la cabecera del documento. El enlace a la venta se resuelve en el
-- frontend con DocumentoItem.IdDocumentoRef (no requiere cambios de datos).
--
-- Se actualizan las DOS funciones que generan ese texto:
--   * registrar_abono_multi_item (alta)
--   * modificar_abono            (edición de abono de 1 deuda)
-- y se hace un backfill de los ítems de abono ya existentes.
-- =============================================================

-- ---------------------------------------------------------------------
-- 1. registrar_abono_multi_item — nuevo formato de item + FechaEmision
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_abono_multi_item(
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
  v_item_desc   TEXT;
  v_doc_id      BIGINT;
  v_deuda       RECORD;
  v_id_cliente  BIGINT;
  v_cliente     TEXT;
  v_id_negocio  BIGINT;
  v_n           INT := 0;
  v_resumen     TEXT;
  v_doc_concepto TEXT;
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

  -- Datos para el documento padre: cliente y negocio de la deuda más antigua
  SELECT d."IdCliente", d."IdNegocio", c."Nombre"
  INTO v_id_cliente, v_id_negocio, v_cliente
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
  LIMIT 1;

  INSERT INTO "Documento" (
    "FechaEmision", "Descripcion", "Concepto", "Total", "bCredito",
    "IdCliente", "IdClienteDireccion", "DireccionEntrega", "TotalAbono",
    "IdTipoDocumento", "Saldo", "IdMetodoPago", "IdTenant", "IdNegocio", "Estado",
    "IdUsuarioCreacion", "FechaCreacion"
  ) VALUES (
    p_fecha, 'Abono', 'Abono', 0, false,
    v_id_cliente, NULL, NULL, 0,
    2, 0, NULLIF(p_id_metodo_pago, 0),
    p_id_tenant, COALESCE(p_id_negocio, v_id_negocio), 1,
    p_id_usuario, NOW()
  ) RETURNING id INTO v_doc_id;

  -- Distribuir FIFO: un DocumentoItem por deuda, todos bajo el mismo documento
  FOR v_deuda IN
    SELECT d.id, d."Total", d."Saldo", d."IdCliente", d."IdNegocio",
           d."FechaEmision", c."Nombre" AS cliente_nombre
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

    -- % de la venta original cubierto por este abono (solo informativo)
    v_pct := COALESCE(ROUND(v_abonar / NULLIF(v_deuda."Total", 0) * 100), 0);
    -- Formato "Ref": fecha de la venta · Venta #id (%). El cliente no se
    -- repite aquí (ya está en la cabecera del documento de abono).
    v_item_desc := format(
      'Ref: %s · Venta #%s (%s%%)',
      to_char(v_deuda."FechaEmision", 'DD/MM/YY'),
      lpad(v_deuda.id::text, 5, '0'),
      v_pct
    );

    INSERT INTO "DocumentoItem" (
      "IdProducto", "Descripcion", "Cantidad", "PrecioVenta",
      "MontoAbono", "Total", "IdDocumento", "IdDocumentoRef",
      "IdTenant", "IdNegocio", "Estado"
    ) VALUES (
      0, v_item_desc, 1, v_abonar,
      v_abonar, v_abonar, v_doc_id, v_deuda.id,
      p_id_tenant, COALESCE(p_id_negocio, v_deuda."IdNegocio"), 1
    );

    v_n := v_n + 1;
    v_restante := v_restante - v_abonar;
  END LOOP;

  -- Resumen del documento padre: con 1 deuda usa el texto Ref del ítem; con
  -- varias, "Abono {cliente} — {N} deudas". Respeta el concepto del usuario.
  IF v_n = 1 THEN
    v_resumen := v_item_desc;
  ELSE
    v_resumen := format('Abono %s — %s deudas', COALESCE(v_cliente, 'Cliente'), v_n);
  END IF;
  v_doc_concepto := COALESCE(NULLIF(btrim(p_concepto), ''), v_resumen);

  UPDATE "Documento" SET
    "Total"       = p_monto - v_restante,
    "Descripcion" = v_resumen,
    "Concepto"    = v_doc_concepto
  WHERE id = v_doc_id AND "IdTenant" = p_id_tenant;

  RETURN jsonb_build_object(
    'ok', true,
    'abonos', to_jsonb(ARRAY[v_doc_id]),
    'no_distribuido', v_restante
  );

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

-- ---------------------------------------------------------------------
-- 2. modificar_abono — mismo formato "Ref" al editar
-- ---------------------------------------------------------------------
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
  v_venta_fecha  DATE;
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

  SELECT d."Total", d."FechaEmision", c."Nombre"
  INTO v_venta_total, v_venta_fecha, v_cliente
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
    'Ref: %s · Venta #%s (%s%%)',
    to_char(v_venta_fecha, 'DD/MM/YY'),
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

-- ---------------------------------------------------------------------
-- 3. Backfill: reescribe la Descripcion de los ítems de abono existentes
--    (tipo 2) al nuevo formato "Ref". Solo toca DocumentoItem.Descripcion
--    (siempre generada); NO el Concepto del documento padre (puede ser
--    texto del usuario). Recalcula % desde el estado actual de la venta.
-- ---------------------------------------------------------------------
UPDATE "DocumentoItem" di
SET "Descripcion" = format(
      'Ref: %s · Venta #%s (%s%%)',
      to_char(v."FechaEmision", 'DD/MM/YY'),
      lpad(v.id::text, 5, '0'),
      COALESCE(ROUND(di."MontoAbono" / NULLIF(v."Total", 0) * 100), 0)
    )
FROM "Documento" ab, "Documento" v
WHERE ab.id = di."IdDocumento"
  AND ab."IdTipoDocumento" = 2
  AND v.id = di."IdDocumentoRef"
  AND di."IdDocumentoRef" IS NOT NULL
  AND di."IdDocumentoRef" > 0;
