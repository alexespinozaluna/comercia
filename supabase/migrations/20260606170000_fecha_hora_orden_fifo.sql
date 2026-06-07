-- =====================================================================
-- FechaHora unificada: misma logica en la vista y en el FIFO de los RPC
-- =====================================================================
-- Se centraliza la regla "FechaHora" en una funcion fn_fecha_hora(date, tstz):
--   mismo dia de emision y creacion -> usa FechaCreacion (con hora);
--   distinto dia -> usa FechaEmision a 00:00.
--
-- La vista v_deuda_detalle y los loops FIFO de registrar_abono /
-- aplicar_saldo_favor usan la MISMA funcion, asi el orden del display
-- (FechaHora DESC) y el del FIFO (FechaHora ASC) quedan perfectamente
-- alineados (incluido el caso de deudas retro-fechadas del mismo dia).
--
-- STABLE: el cast timestamptz::date depende de la zona de la sesion.
-- Idempotente.
-- Base: 20260603030000 (vista), 20260528020000 (registrar_abono),
--       20260606120000 (aplicar_saldo_favor), 20260606160000 (FechaHora).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.fn_fecha_hora(
  p_fecha_emision  date,
  p_fecha_creacion timestamptz
)
RETURNS timestamp
LANGUAGE sql
STABLE
AS $$
  SELECT (CASE
            WHEN p_fecha_emision = p_fecha_creacion::date THEN p_fecha_creacion
            ELSE p_fecha_emision::timestamptz
          END)::timestamp;
$$;

-- ---------------------------------------------------------------------
-- Vista: usa fn_fecha_hora (DROP CASCADE recrea fn_deuda_resumen)
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS v_deuda_detalle CASCADE;

CREATE VIEW v_deuda_detalle AS
SELECT
  d.id,
  d."IdTenant",
  d."IdNegocio",
  d."Estado",
  d."IdCliente",
  d."Concepto",
  d."Descripcion",
  d."FechaEmision",
  d."FechaCreacion",
  public.fn_fecha_hora(d."FechaEmision", d."FechaCreacion") AS "FechaHora",
  d."DireccionEntrega",
  d."Total",
  d."Saldo",
  d."TotalAbono",
  d."bCredito",
  d."IdTipoDocumento",
  d."IdUsuarioCreacion",
  c."Nombre"      AS "NomCliente",
  c."NroTelefono" AS "NroTelefono",
  u."Nombre"      AS "NomUsuarioCreacion"
FROM "Documento" d
LEFT JOIN "Cliente" c        ON c.id = d."IdCliente"
LEFT JOIN "SistemaUsuario" u ON u.id = d."IdUsuarioCreacion"
WHERE d."bCredito" = true
  AND d."Saldo"    > 0
  AND d."Estado"   = 1;

COMMENT ON VIEW v_deuda_detalle IS
  'Detalle de deuda activa. FechaHora via fn_fecha_hora (misma logica que el FIFO).';

DROP FUNCTION IF EXISTS fn_deuda_resumen(INTEGER, BIGINT);

CREATE FUNCTION fn_deuda_resumen(p_id_tenant INTEGER, p_id_negocio BIGINT DEFAULT NULL)
RETURNS TABLE (
  "IdCliente"       BIGINT,
  "NomCliente"      TEXT,
  "NroTelefono"     TEXT,
  "Cantidad"        BIGINT,
  "SumSaldo"        NUMERIC,
  "MaxFechaEmision" DATE,
  "MaxId"           BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    v."IdCliente",
    v."NomCliente"::TEXT,
    v."NroTelefono"::TEXT,
    COUNT(*)                       AS "Cantidad",
    SUM(v."Saldo")                 AS "SumSaldo",
    MAX(v."FechaEmision")::DATE    AS "MaxFechaEmision",
    MAX(v.id)                      AS "MaxId"
  FROM v_deuda_detalle v
  WHERE v."IdTenant"  = p_id_tenant
    AND v."IdCliente" IS NOT NULL
    AND (p_id_negocio IS NULL OR v."IdNegocio" = p_id_negocio)
  GROUP BY v."IdCliente", v."NomCliente", v."NroTelefono"
  ORDER BY MAX(v."FechaHora") DESC, MAX(v.id) DESC;
$$;

COMMENT ON FUNCTION fn_deuda_resumen(INTEGER, BIGINT) IS
  'Resumen de deuda por cliente. Ordenado por FechaHora DESC.';

GRANT SELECT  ON v_deuda_detalle TO anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_deuda_resumen(INTEGER, BIGINT) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- registrar_abono: FIFO ordenado por fn_fecha_hora ASC (= FechaHora)
-- ---------------------------------------------------------------------
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
    ORDER BY public.fn_fecha_hora(d."FechaEmision", d."FechaCreacion") ASC, d.id ASC
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
-- aplicar_saldo_favor: ambos FIFO ordenados por fn_fecha_hora ASC
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aplicar_saldo_favor(
  p_tipo       INT,
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

  PERFORM 1
  FROM "Documento" d
  WHERE d."IdTenant" = p_id_tenant
    AND d."IdTipoDocumento" = 4
    AND d."Estado" = 1
    AND d."Saldo" > 0
    AND d."IdCliente" = v_id_cliente
    AND (p_id_negocio IS NULL OR d."IdNegocio" = p_id_negocio)
  FOR UPDATE;

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
    ORDER BY public.fn_fecha_hora(d."FechaEmision", d."FechaCreacion") ASC, d.id ASC
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

  IF v_total_aplicado <= 0 THEN
    DELETE FROM "Documento" WHERE id = v_doc_id;
    RETURN jsonb_build_object('ok', true, 'doc_id', NULL, 'aplicado', 0);
  END IF;

  UPDATE "Documento" SET "Total" = v_total_aplicado WHERE id = v_doc_id;

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
    ORDER BY public.fn_fecha_hora(d."FechaEmision", d."FechaCreacion") ASC, d.id ASC
  LOOP
    EXIT WHEN v_restante_favor <= 0;
    v_aplicar := LEAST(v_restante_favor, v_favor."Saldo");

    INSERT INTO "DocumentoItem" (
      "IdProducto", "Descripcion", "Cantidad", "PrecioVenta",
      "MontoAbono", "Total", "IdDocumento", "IdDocumentoRef",
      "IdTenant", "IdNegocio", "Estado"
    ) VALUES (
      0, 'Saldo a favor utilizado', 1, v_aplicar,
      v_aplicar,
      0,
      v_doc_id, v_favor.id, p_id_tenant,
      COALESCE(p_id_negocio, v_favor."IdNegocio"), 1
    );

    v_restante_favor := v_restante_favor - v_aplicar;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'doc_id', v_doc_id, 'aplicado', v_total_aplicado);

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_fecha_hora(date, timestamptz) TO anon, authenticated;
