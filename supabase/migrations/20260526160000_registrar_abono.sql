-- =============================================================
-- registrar_abono: registra un abono (pago) sobre deudas, de forma
-- ATÓMICA y con la distribución calculada en el servidor.
--
--   p_tipo = 1 → abona a UNA venta (p_id = IdDocumento de la venta)
--   p_tipo = 2 → abona al TOTAL de deudas de un cliente (p_id = IdCliente)
--
-- Reglas:
--   * Las deudas se cubren FIFO: de la MÁS ANTIGUA a la más reciente
--     (ORDER BY "FechaEmision" ASC, id ASC).
--   * Se valida que el monto no supere la suma de saldos pendientes.
--   * Por CADA deuda cubierta se crea un Documento (IdTipoDocumento=2)
--     con UN DocumentoItem que referencia la venta (IdDocumentoRef).
--     Relación 1:1 abono↔deuda → fácil de editar/anular después.
--   * El trigger trg_actualizar_saldo_total_abono recalcula el Saldo y
--     TotalAbono de cada venta a partir de SUM(MontoAbono) por IdDocumentoRef.
--   * Cantidad se deja en 1 (no se usa como fracción); el % va solo en el texto.
--
-- Toda la operación corre en una transacción implícita: si algo falla,
-- PostgreSQL hace rollback de todos los abonos.
-- =============================================================

CREATE OR REPLACE FUNCTION public.registrar_abono(
  p_tipo            INT,
  p_id             BIGINT,
  p_monto           NUMERIC,
  p_fecha           DATE,
  p_concepto        TEXT,
  p_id_metodo_pago  BIGINT,
  p_id_tenant       INT,
  p_id_usuario      INT
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

  -- Bloquear las deudas relevantes hasta el fin de la transacción
  -- (evita doble abono concurrente sobre las mismas deudas).
  PERFORM 1
  FROM "Documento" d
  WHERE d."IdTenant" = p_id_tenant
    AND d."bCredito" = true
    AND d."Saldo" > 0
    AND d."Estado" = 1
    AND ( (p_tipo = 1 AND d.id = p_id)
       OR (p_tipo = 2 AND d."IdCliente" = p_id) )
  FOR UPDATE;

  -- Suma de saldos pendientes (ya bloqueados)
  SELECT COALESCE(SUM(d."Saldo"), 0)
  INTO v_suma_saldo
  FROM "Documento" d
  WHERE d."IdTenant" = p_id_tenant
    AND d."bCredito" = true
    AND d."Saldo" > 0
    AND d."Estado" = 1
    AND ( (p_tipo = 1 AND d.id = p_id)
       OR (p_tipo = 2 AND d."IdCliente" = p_id) );

  IF p_monto > v_suma_saldo + 0.01 THEN
    RAISE EXCEPTION 'El monto ingresado es mayor a la deuda';
  END IF;

  -- Distribuir FIFO: de la deuda más antigua a la más reciente
  FOR v_deuda IN
    SELECT d.id, d."Total", d."Saldo", d."IdCliente", d."DireccionEntrega",
           c."Nombre" AS cliente_nombre
    FROM "Documento" d
    LEFT JOIN "Cliente" c ON c.id = d."IdCliente"
    WHERE d."IdTenant" = p_id_tenant
      AND d."bCredito" = true
      AND d."Saldo" > 0
      AND d."Estado" = 1
      AND ( (p_tipo = 1 AND d.id = p_id)
         OR (p_tipo = 2 AND d."IdCliente" = p_id) )
    ORDER BY d."FechaEmision" ASC, d.id ASC
  LOOP
    EXIT WHEN v_restante <= 0;

    v_abonar := LEAST(v_restante, v_deuda."Saldo");

    -- % de la venta original cubierto por este abono (solo informativo)
    v_pct := COALESCE(ROUND(v_abonar / NULLIF(v_deuda."Total", 0) * 100), 0);
    v_concepto := format(
      'Abono %s — Venta #%s (%s%%)',
      COALESCE(v_deuda.cliente_nombre, 'Cliente'),
      lpad(v_deuda.id::text, 5, '0'),
      v_pct
    );
    -- Concepto del documento: respeta el que escribió el usuario, si lo hay
    v_doc_concepto := COALESCE(NULLIF(btrim(p_concepto), ''), v_concepto);

    INSERT INTO "Documento" (
      "FechaEmision", "Descripcion", "Concepto", "Total", "bCredito",
      "IdCliente", "IdClienteDireccion", "DireccionEntrega", "TotalAbono",
      "IdTipoDocumento", "Saldo", "IdMetodoPago", "IdTenant", "Estado",
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
      1,
      p_id_usuario,
      NOW()
    ) RETURNING id INTO v_doc_id;

    INSERT INTO "DocumentoItem" (
      "IdProducto", "Descripcion", "Cantidad", "PrecioVenta",
      "MontoAbono", "Total", "IdDocumento", "IdDocumentoRef",
      "IdTenant", "Estado"
    ) VALUES (
      0,
      v_concepto,
      1,
      v_abonar,
      v_abonar,
      v_abonar,
      v_doc_id,
      v_deuda.id,        -- referencia a la venta → dispara recálculo de Saldo
      p_id_tenant,
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
  RAISE; -- rollback automático de todos los abonos creados
END;
$$;
