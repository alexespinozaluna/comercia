-- =====================================================================
-- SALDO A FAVOR (sobrepago) — Fase 1: capturar el excedente
-- =====================================================================
-- Redefine registrar_abono para que, en lugar de RECHAZAR un pago mayor a
-- la deuda, distribuya FIFO lo que cubra deudas (IDÉNTICO a hoy) y guarde el
-- excedente como un Documento "Saldo a favor" (IdTipoDocumento = 4).
--
--   * La cancelación de deuda NO cambia: el loop FIFO sigue usando
--     LEAST(restante, Saldo); ninguna venta queda con Saldo negativo.
--   * El excedente (v_restante > 0 tras el loop) crea UN Documento tipo 4:
--       - bCredito = false, IdCliente = cliente, Estado = 1
--       - Total = Saldo = excedente (Saldo = crédito disponible para Fase 2)
--       - hereda IdNegocio de la sucursal activa / deuda
--   * Se devuelve saldo_favor_id + saldo_favor para que la API lo vincule a
--     la caja (es dinero real recibido → arqueo e ingreso del día).
--
-- Mismo signature que la versión fase3a → CREATE OR REPLACE.
-- Idempotente.
-- =====================================================================

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
  v_restante      NUMERIC := p_monto;
  v_abonar        NUMERIC;
  v_pct           INT;
  v_concepto      TEXT;
  v_doc_concepto  TEXT;
  v_doc_id        BIGINT;
  v_abonos        BIGINT[] := '{}';
  v_deuda         RECORD;
  -- Saldo a favor
  v_id_cliente    BIGINT;
  v_cliente_nombre TEXT;
  v_negocio_ctx   BIGINT;     -- negocio de referencia (venta tipo 1 o última deuda)
  v_favor_monto   NUMERIC := 0;
  v_favor_id      BIGINT;
  v_favor_concepto TEXT;
BEGIN
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor a cero';
  END IF;

  -- Cliente y negocio de referencia para un eventual saldo a favor.
  IF p_tipo = 2 THEN
    v_id_cliente := p_id;
  ELSE
    SELECT d."IdCliente", d."IdNegocio"
    INTO v_id_cliente, v_negocio_ctx
    FROM "Documento" d
    WHERE d.id = p_id AND d."IdTenant" = p_id_tenant;
  END IF;

  SELECT c."Nombre" INTO v_cliente_nombre
  FROM "Cliente" c WHERE c.id = v_id_cliente;

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

  -- Distribuir FIFO: de la deuda más antigua a la más reciente (igual que antes)
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

    v_negocio_ctx := COALESCE(v_negocio_ctx, v_deuda."IdNegocio");
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
      p_fecha, v_concepto, v_doc_concepto, v_abonar, false,
      v_deuda."IdCliente", NULL, NULL, 0,
      2, 0, NULLIF(p_id_metodo_pago, 0), p_id_tenant,
      COALESCE(p_id_negocio, v_deuda."IdNegocio"), 1, p_id_usuario, NOW()
    ) RETURNING id INTO v_doc_id;

    INSERT INTO "DocumentoItem" (
      "IdProducto", "Descripcion", "Cantidad", "PrecioVenta",
      "MontoAbono", "Total", "IdDocumento", "IdDocumentoRef",
      "IdTenant", "IdNegocio", "Estado"
    ) VALUES (
      0, v_concepto, 1, v_abonar, v_abonar, v_abonar,
      v_doc_id, v_deuda.id, p_id_tenant,
      COALESCE(p_id_negocio, v_deuda."IdNegocio"), 1
    );

    v_abonos := array_append(v_abonos, v_doc_id);
    v_restante := v_restante - v_abonar;
  END LOOP;

  -- Excedente → Documento de saldo a favor (IdTipoDocumento = 4)
  IF v_restante > 0.005 THEN
    v_favor_monto := v_restante;
    v_favor_concepto := format('Saldo a favor — %s', COALESCE(v_cliente_nombre, 'Cliente'));

    INSERT INTO "Documento" (
      "FechaEmision", "Descripcion", "Concepto", "Total", "bCredito",
      "IdCliente", "IdClienteDireccion", "DireccionEntrega", "TotalAbono",
      "IdTipoDocumento", "Saldo", "IdMetodoPago", "IdTenant", "IdNegocio", "Estado",
      "IdUsuarioCreacion", "FechaCreacion"
    ) VALUES (
      p_fecha,
      v_favor_concepto,
      COALESCE(NULLIF(btrim(p_concepto), ''), v_favor_concepto),
      v_favor_monto,
      false,
      v_id_cliente, NULL, NULL, 0,
      4,                       -- saldo a favor
      v_favor_monto,           -- Saldo = crédito disponible (Fase 2)
      NULLIF(p_id_metodo_pago, 0),
      p_id_tenant,
      COALESCE(p_id_negocio, v_negocio_ctx),
      1, p_id_usuario, NOW()
    ) RETURNING id INTO v_favor_id;

    v_restante := 0;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'abonos', to_jsonb(v_abonos),
    'saldo_favor_id', v_favor_id,
    'saldo_favor', v_favor_monto,
    'no_distribuido', v_restante
  );

EXCEPTION WHEN OTHERS THEN
  RAISE; -- rollback automático de todo el bloque
END;
$$;

COMMENT ON FUNCTION public.registrar_abono(INT, BIGINT, NUMERIC, DATE, TEXT, BIGINT, INT, INT, BIGINT) IS
  'Registra abono: distribuye FIFO sobre deudas y guarda el excedente como Documento tipo 4 (saldo a favor).';
