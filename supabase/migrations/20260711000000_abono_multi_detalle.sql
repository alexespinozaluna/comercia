-- =============================================================
-- registrar_abono_multi_item: registra un abono como UN solo Documento
-- (IdTipoDocumento=2) con N DocumentoItem, uno por cada deuda cubierta.
-- (Propuesta 2026-07-11.)
--
-- Se crea como función NUEVA — NO se modifica registrar_abono (modelo 1:1,
-- un Documento por deuda), que queda intacto y disponible. Así el cambio de
-- contrato (N documentos → 1 documento) es explícito, reversible (basta
-- reapuntar el service) y no altera la función establecida ni sus datos.
--
-- Modelo:
--   * Un abono = UN Documento (el pago) con N DocumentoItem (una por deuda,
--     cada item con su IdDocumentoRef). Documento.Total = "con cuánto abonó
--     el cliente", con un solo método de pago, fecha y caja.
--
-- Regla de negocio (decisión de la propuesta):
--   * Abono de UNA sola deuda (1 item) → editable (modificar_abono lo exige).
--   * Abono de VARIAS deudas (N items) → NO editable: solo se elimina
--     (borrado físico → cascada + trigger restauran los Saldos).
--
-- Comparte con registrar_abono:
--   * El reparto FIFO (deuda más antigua primero) y su validación.
--   * El trigger fn_actualizar_saldo_total_abono: suma MontoAbono por
--     IdDocumentoRef, así que N items en un mismo documento recalculan
--     correctamente los N Saldos. No se toca.
--   * El contrato de retorno: 'abonos' es un array de ids de Documento
--     (aquí con 1 elemento) → /api/abonos lo vincula a la caja.
--
-- Todo corre en una transacción implícita: si algo falla, rollback.
-- =============================================================

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
  -- (en tipo 2 todas comparten IdCliente; en tipo 1 hay una sola).
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

  -- Crear UN documento de pago. Total/Concepto se ajustan al final, cuando
  -- se conoce cuántas deudas cubrió (v_n) y el monto realmente distribuido.
  INSERT INTO "Documento" (
    "FechaEmision", "Descripcion", "Concepto", "Total", "bCredito",
    "IdCliente", "IdClienteDireccion", "DireccionEntrega", "TotalAbono",
    "IdTipoDocumento", "Saldo", "IdMetodoPago", "IdTenant", "IdNegocio", "Estado",
    "IdUsuarioCreacion", "FechaCreacion"
  ) VALUES (
    p_fecha,
    'Abono',
    'Abono',
    0,
    false,
    v_id_cliente,
    NULL,
    NULL,
    0,
    2,
    0,
    NULLIF(p_id_metodo_pago, 0),
    p_id_tenant,
    COALESCE(p_id_negocio, v_id_negocio),
    1,
    p_id_usuario,
    NOW()
  ) RETURNING id INTO v_doc_id;

  -- Distribuir FIFO: un DocumentoItem por deuda, todos bajo el mismo documento
  FOR v_deuda IN
    SELECT d.id, d."Total", d."Saldo", d."IdCliente", d."IdNegocio",
           c."Nombre" AS cliente_nombre
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
    v_item_desc := format(
      'Abono %s — Venta #%s (%s%%)',
      COALESCE(v_deuda.cliente_nombre, 'Cliente'),
      lpad(v_deuda.id::text, 5, '0'),
      v_pct
    );

    INSERT INTO "DocumentoItem" (
      "IdProducto", "Descripcion", "Cantidad", "PrecioVenta",
      "MontoAbono", "Total", "IdDocumento", "IdDocumentoRef",
      "IdTenant", "IdNegocio", "Estado"
    ) VALUES (
      0,
      v_item_desc,
      1,
      v_abonar,
      v_abonar,
      v_abonar,
      v_doc_id,
      v_deuda.id,        -- referencia a la venta → dispara recálculo de Saldo
      p_id_tenant,
      COALESCE(p_id_negocio, v_deuda."IdNegocio"),
      1
    );

    v_n := v_n + 1;
    v_restante := v_restante - v_abonar;
  END LOOP;

  -- Resumen del documento padre. Con una sola deuda conserva el texto por
  -- venta (compatibilidad visual con el modelo 1:1); con varias, un resumen
  -- "Abono {cliente} — {N} deudas". Respeta el concepto del usuario.
  IF v_n = 1 THEN
    v_resumen := v_item_desc;  -- texto de la única deuda (última iteración)
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
  RAISE; -- rollback automático del documento y sus items
END;
$$;
