-- =====================================================================
-- SALDO A FAVOR — Fase 2: consumir el crédito (en venta-abono)
-- =====================================================================
-- 1) aplicar_saldo_favor: paga deudas del cliente usando su saldo a favor.
--    - NO entra dinero: el movimiento es un Documento tipo 6
--      ("Abono con saldo a favor") con IdCaja = NULL e IdMetodoPago = NULL,
--      por lo que el arqueo lo ignora y la home lo excluye del ingreso.
--    - Crea items que referencian cada deuda (FIFO) → el trigger
--      fn_actualizar_saldo_total_abono baja el Saldo de la deuda.
--    - Decrementa FIFO el Saldo de los documentos tipo 4 (crédito disponible).
--
-- 2) fn_caja_arqueo: ahora cuenta el tipo 4 (saldo a favor capturado) como
--    entrada de efectivo (arregla el hueco de Fase 1: el dinero está en el
--    cajón pero no se reflejaba en el monto esperado).
--
-- Idempotente.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.aplicar_saldo_favor(
  p_tipo       INT,          -- 1 = venta (p_id = venta) · 2 = cliente (p_id = cliente)
  p_id         BIGINT,
  p_monto      NUMERIC,
  p_fecha      DATE,
  p_concepto   TEXT,
  p_id_tenant  INT,
  p_id_usuario INT,
  p_id_negocio BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_id_cliente      BIGINT;
  v_negocio_ctx     BIGINT;
  v_cliente_nombre  TEXT;
  v_disponible      NUMERIC;
  v_restante        NUMERIC := p_monto;
  v_aplicar         NUMERIC;
  v_doc_id          BIGINT;
  v_total_aplicado  NUMERIC := 0;
  v_restante_favor  NUMERIC;
  v_deuda           RECORD;
  v_favor           RECORD;
  v_concepto_doc    TEXT;
BEGIN
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor a cero';
  END IF;

  -- Cliente (y negocio de referencia para tipo 1)
  IF p_tipo = 2 THEN
    v_id_cliente := p_id;
  ELSIF p_tipo = 1 THEN
    SELECT d."IdCliente", d."IdNegocio"
    INTO v_id_cliente, v_negocio_ctx
    FROM "Documento" d
    WHERE d.id = p_id AND d."IdTenant" = p_id_tenant;
  ELSE
    RAISE EXCEPTION 'tipo inválido (1 = venta, 2 = cliente)';
  END IF;

  IF v_id_cliente IS NULL THEN
    RAISE EXCEPTION 'Cliente no resuelto';
  END IF;

  SELECT c."Nombre" INTO v_cliente_nombre FROM "Cliente" c WHERE c.id = v_id_cliente;

  -- Bloquear los docs de saldo a favor del cliente (FOR UPDATE no se permite
  -- junto a un agregado, así que el lock va aparte de la suma).
  PERFORM 1
  FROM "Documento" d
  WHERE d."IdTenant" = p_id_tenant
    AND d."IdTipoDocumento" = 4
    AND d."Estado" = 1
    AND d."Saldo" > 0
    AND d."IdCliente" = v_id_cliente
    AND (p_id_negocio IS NULL OR d."IdNegocio" = p_id_negocio)
  FOR UPDATE;

  -- Sumar el saldo a favor disponible (ya bloqueado)
  SELECT COALESCE(SUM(d."Saldo"), 0) INTO v_disponible
  FROM "Documento" d
  WHERE d."IdTenant" = p_id_tenant
    AND d."IdTipoDocumento" = 4
    AND d."Estado" = 1
    AND d."Saldo" > 0
    AND d."IdCliente" = v_id_cliente
    AND (p_id_negocio IS NULL OR d."IdNegocio" = p_id_negocio);

  IF p_monto > v_disponible + 0.01 THEN
    RAISE EXCEPTION 'Saldo a favor insuficiente (disponible: %)', v_disponible;
  END IF;

  v_concepto_doc := format('Pago con saldo a favor — %s', COALESCE(v_cliente_nombre, 'Cliente'));

  -- Documento tipo 6: abono con saldo a favor (no entra a caja ni a ingresos)
  INSERT INTO "Documento" (
    "FechaEmision", "Descripcion", "Concepto", "Total", "bCredito",
    "IdCliente", "IdClienteDireccion", "DireccionEntrega", "TotalAbono",
    "IdTipoDocumento", "Saldo", "IdMetodoPago", "IdCaja", "IdTenant", "IdNegocio", "Estado",
    "IdUsuarioCreacion", "FechaCreacion"
  ) VALUES (
    p_fecha, v_concepto_doc,
    COALESCE(NULLIF(btrim(p_concepto), ''), v_concepto_doc),
    0, false,
    v_id_cliente, NULL, NULL, 0,
    6, 0, NULL, NULL, p_id_tenant,
    COALESCE(p_id_negocio, v_negocio_ctx), 1, p_id_usuario, NOW()
  ) RETURNING id INTO v_doc_id;

  -- FIFO sobre las deudas: item por deuda → el trigger baja su Saldo
  FOR v_deuda IN
    SELECT d.id, d."Saldo", d."IdNegocio"
    FROM "Documento" d
    WHERE d."IdTenant" = p_id_tenant
      AND d."bCredito" = true
      AND d."Saldo" > 0
      AND d."Estado" = 1
      AND (p_id_negocio IS NULL OR d."IdNegocio" = p_id_negocio)
      AND ( (p_tipo = 1 AND d.id = p_id)
         OR (p_tipo = 2 AND d."IdCliente" = v_id_cliente) )
    ORDER BY d."FechaEmision" ASC, d.id ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_restante <= 0;
    v_aplicar := LEAST(v_restante, v_deuda."Saldo");

    INSERT INTO "DocumentoItem" (
      "IdProducto", "Descripcion", "Cantidad", "PrecioVenta",
      "MontoAbono", "Total", "IdDocumento", "IdDocumentoRef",
      "IdTenant", "IdNegocio", "Estado"
    ) VALUES (
      0, format('Saldo a favor — Venta #%s', lpad(v_deuda.id::text, 5, '0')),
      1, v_aplicar, v_aplicar, v_aplicar,
      v_doc_id, v_deuda.id, p_id_tenant,
      COALESCE(p_id_negocio, v_deuda."IdNegocio"), 1
    );

    v_restante := v_restante - v_aplicar;
    v_total_aplicado := v_total_aplicado + v_aplicar;
  END LOOP;

  -- Sin deuda que cubrir → no se aplica nada; borrar el doc vacío
  IF v_total_aplicado <= 0 THEN
    DELETE FROM "Documento" WHERE id = v_doc_id;
    RETURN jsonb_build_object('ok', true, 'doc_id', NULL, 'aplicado', 0);
  END IF;

  UPDATE "Documento" SET "Total" = v_total_aplicado WHERE id = v_doc_id;

  -- FIFO sobre los docs tipo 4: crear un item que los REFERENCIA (no UPDATE
  -- manual). El trigger fn_actualizar_saldo_total_abono baja su Saldo
  -- (Saldo = Total − SUM MontoAbono). Así, al ELIMINAR este documento
  -- (cascada de items + trigger) el crédito se restaura solo: anular = eliminar.
  v_restante_favor := v_total_aplicado;
  FOR v_favor IN
    SELECT d.id, d."Saldo", d."IdNegocio"
    FROM "Documento" d
    WHERE d."IdTenant" = p_id_tenant
      AND d."IdTipoDocumento" = 4
      AND d."Estado" = 1
      AND d."Saldo" > 0
      AND d."IdCliente" = v_id_cliente
      AND (p_id_negocio IS NULL OR d."IdNegocio" = p_id_negocio)
    ORDER BY d."FechaEmision" ASC, d.id ASC
  LOOP
    EXIT WHEN v_restante_favor <= 0;
    v_aplicar := LEAST(v_restante_favor, v_favor."Saldo");

    INSERT INTO "DocumentoItem" (
      "IdProducto", "Descripcion", "Cantidad", "PrecioVenta",
      "MontoAbono", "Total", "IdDocumento", "IdDocumentoRef",
      "IdTenant", "IdNegocio", "Estado"
    ) VALUES (
      0, 'Saldo a favor utilizado', 1, v_aplicar,
      v_aplicar,   -- MontoAbono → el trigger baja el Saldo del doc tipo 4
      0,           -- Total 0: no infla el Total del documento tipo 6
      v_doc_id, v_favor.id, p_id_tenant,
      COALESCE(p_id_negocio, v_favor."IdNegocio"), 1
    );

    v_restante_favor := v_restante_favor - v_aplicar;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'doc_id', v_doc_id, 'aplicado', v_total_aplicado);

EXCEPTION WHEN OTHERS THEN
  RAISE; -- rollback de toda la operación
END;
$$;

COMMENT ON FUNCTION public.aplicar_saldo_favor(INT, BIGINT, NUMERIC, DATE, TEXT, INT, INT, BIGINT) IS
  'Consume saldo a favor (tipo 4) para pagar deudas: crea un abono tipo 6 sin caja/ingreso y decrementa el credito disponible.';

-- ---------------------------------------------------------------------
-- fn_caja_arqueo: incluir el tipo 4 (saldo a favor capturado) como efectivo
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_caja_arqueo(
  p_id_caja   BIGINT,
  p_id_tenant BIGINT
)
RETURNS TABLE (
  "IdCaja"          BIGINT,
  "MontoInicial"    NUMERIC,
  "VentasEfectivo"  NUMERIC,
  "AbonosEfectivo"  NUMERIC,
  "GastosEfectivo"  NUMERIC,
  "MontoEsperado"   NUMERIC,
  "CntVentas"       BIGINT,
  "CntAbonos"       BIGINT,
  "CntGastos"       BIGINT
) AS $$
DECLARE
  v_inicial NUMERIC(18,2);
BEGIN
  SELECT c."MontoInicial" INTO v_inicial
  FROM "Caja" c
  WHERE c.id = p_id_caja AND c."IdTenant" = p_id_tenant;

  IF v_inicial IS NULL THEN
    RAISE EXCEPTION 'Caja % no encontrada en tenant %', p_id_caja, p_id_tenant;
  END IF;

  RETURN QUERY
  WITH
    ventas AS (
      SELECT COALESCE(SUM(d."Total"), 0)::NUMERIC(18,2) AS monto, COUNT(*) AS cnt
      FROM "Documento" d
      LEFT JOIN "MetodoPago" mp ON mp.id = d."IdMetodoPago"
      WHERE d."IdCaja" = p_id_caja
        AND d."IdTenant" = p_id_tenant
        AND d."IdTipoDocumento" = 1
        AND d."Estado" = 1
        AND d."bCredito" = FALSE
        AND COALESCE(mp."bEfectivo", FALSE) = TRUE
    ),
    -- Abonos (tipo 2) + Saldo a favor capturado (tipo 4): ambos son dinero
    -- recibido en el cajón. El consumo de saldo a favor (tipo 6) NO entra
    -- aquí (IdCaja NULL y no es tipo 1/2/3/4).
    abonos AS (
      SELECT COALESCE(SUM(d."Total"), 0)::NUMERIC(18,2) AS monto, COUNT(*) AS cnt
      FROM "Documento" d
      LEFT JOIN "MetodoPago" mp ON mp.id = d."IdMetodoPago"
      WHERE d."IdCaja" = p_id_caja
        AND d."IdTenant" = p_id_tenant
        AND d."IdTipoDocumento" IN (2, 4)
        AND d."Estado" = 1
        AND COALESCE(mp."bEfectivo", FALSE) = TRUE
    ),
    gastos AS (
      SELECT COALESCE(SUM(d."Total"), 0)::NUMERIC(18,2) AS monto, COUNT(*) AS cnt
      FROM "Documento" d
      LEFT JOIN "MetodoPago" mp ON mp.id = d."IdMetodoPago"
      WHERE d."IdCaja" = p_id_caja
        AND d."IdTenant" = p_id_tenant
        AND d."IdTipoDocumento" = 3
        AND d."Estado" = 1
        AND COALESCE(mp."bEfectivo", FALSE) = TRUE
    )
  SELECT
    p_id_caja,
    v_inicial,
    ventas.monto,
    abonos.monto,
    gastos.monto,
    (v_inicial + ventas.monto + abonos.monto - gastos.monto)::NUMERIC(18,2),
    ventas.cnt,
    abonos.cnt,
    gastos.cnt
  FROM ventas, abonos, gastos;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
