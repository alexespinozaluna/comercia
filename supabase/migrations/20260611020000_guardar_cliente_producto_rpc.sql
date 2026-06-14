-- =====================================================================
-- GUARDADO TRANSACCIONAL — Cliente+Direcciones y Producto+Kardex inicial
-- =====================================================================
-- Problema que resuelve:
--   Los API routes hacían estos guardados maestro-detalle en varias llamadas
--   PostgREST independientes (cada una su propia transacción):
--     * POST /api/clientes  → insert Cliente, luego insert direcciones
--       ("No hacemos rollback" si fallaba la segunda).
--     * PUT  /api/clientes/[id] → update + soft-deletes + updates + inserts
--       en 4 fases; cada error solo se logueaba y se continuaba.
--     * POST /api/productos → insert Producto, luego upsert ProductoStock,
--       luego insert ProductoMovimiento (kardex inicial); un fallo a mitad
--       dejaba stock y kardex desalineados.
--   Un fallo parcial dejaba datos a medias e invisibles para el usuario.
--
-- Solución: mover cada guardado a una función plpgsql (una transacción:
-- o todo o nada), siguiendo el patrón de guardar_venta_con_items.
-- El diff de direcciones (delete/update/insert) se calcula aquí dentro,
-- de modo que el route solo arma el payload deseado.
--
-- Convención de auditoría: IdUsuarioCreacion / IdUsuarioModificacion /
-- FechaModificacion viajan dentro del JSON (helpers lib/audit.ts).
--
-- Nota: el trigger trg_movimiento_stock actúa solo sobre DocumentoItem
-- (ventas); el "Stock inicial" (tipo 2) se siembra aquí directamente,
-- igual que lo hacía el route. No hay doble conteo.
--
-- Idempotente.
-- Base: docs/analisis-guardado-transaccional-y-hook-saving-2026-06-10.md
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. guardar_cliente_con_direcciones
--    p_id_cliente NULL/0 = crear; > 0 = modificar (diff de direcciones).
--    p_direcciones = lista COMPLETA deseada: id > 0 conserva/actualiza,
--    id 0/null inserta; las activas ausentes se soft-borran (Estado = 0).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guardar_cliente_con_direcciones(
  p_id_cliente   BIGINT,
  p_cliente      JSONB,
  p_direcciones  JSONB,
  p_id_tenant    INT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_id_cliente BIGINT;
  v_dir        JSONB;
  v_result     JSONB;
BEGIN
  IF COALESCE(btrim(p_cliente->>'Nombre'), '') = '' THEN
    RAISE EXCEPTION 'Nombre requerido';
  END IF;

  -- ── CREAR ─────────────────────────────────────────────────
  IF p_id_cliente IS NULL OR p_id_cliente = 0 THEN

    INSERT INTO "Cliente" (
      "Nombre", "NroTelefono", "TipoDocumento", "NroDocumento", "Comentario",
      "IdTenant", "Estado", "IdUsuarioCreacion"
    ) VALUES (
      p_cliente->>'Nombre',
      NULLIF(p_cliente->>'NroTelefono', ''),
      NULLIF(p_cliente->>'TipoDocumento', ''),
      NULLIF(p_cliente->>'NroDocumento', ''),
      NULLIF(p_cliente->>'Comentario', ''),
      p_id_tenant,
      1,
      NULLIF((p_cliente->>'IdUsuarioCreacion')::TEXT, '')::BIGINT
    ) RETURNING id INTO v_id_cliente;

    INSERT INTO "ClienteDireccion" (
      "Direccion", "Telefono", "Contacto", "bPrincipal",
      "IdCliente", "IdTenant", "Estado", "IdUsuarioCreacion"
    )
    SELECT
      d->>'Direccion',
      NULLIF(d->>'Telefono', ''),
      d->>'Contacto',
      COALESCE((d->>'bPrincipal')::BOOLEAN, false),
      v_id_cliente,
      p_id_tenant,
      1,
      NULLIF((d->>'IdUsuarioCreacion')::TEXT, '')::BIGINT
    FROM jsonb_array_elements(COALESCE(p_direcciones, '[]'::jsonb)) AS d;

    SELECT to_jsonb(c.*) FROM "Cliente" c WHERE c.id = v_id_cliente INTO v_result;
    RETURN v_result;

  -- ── MODIFICAR ─────────────────────────────────────────────
  ELSE

    IF NOT EXISTS (
      SELECT 1 FROM "Cliente"
      WHERE id = p_id_cliente AND "IdTenant" = p_id_tenant AND "Estado" = 1
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Cliente no encontrado');
    END IF;

    UPDATE "Cliente" SET
      "Nombre"                = p_cliente->>'Nombre',
      "NroTelefono"           = NULLIF(p_cliente->>'NroTelefono', ''),
      "TipoDocumento"         = NULLIF(p_cliente->>'TipoDocumento', ''),
      "NroDocumento"          = NULLIF(p_cliente->>'NroDocumento', ''),
      "Comentario"            = NULLIF(p_cliente->>'Comentario', ''),
      "IdUsuarioModificacion" = NULLIF((p_cliente->>'IdUsuarioModificacion')::TEXT, '')::BIGINT,
      "FechaModificacion"     = COALESCE(NULLIF(p_cliente->>'FechaModificacion', '')::TIMESTAMPTZ, NOW())
    WHERE id = p_id_cliente AND "IdTenant" = p_id_tenant;

    -- Soft-delete: direcciones activas que ya no vienen en el payload.
    UPDATE "ClienteDireccion" SET
      "Estado"                = 0,
      "IdUsuarioModificacion" = NULLIF((p_cliente->>'IdUsuarioModificacion')::TEXT, '')::BIGINT,
      "FechaModificacion"     = NOW()
    WHERE "IdCliente" = p_id_cliente
      AND "IdTenant"  = p_id_tenant
      AND "Estado"    = 1
      AND id NOT IN (
        SELECT (d->>'id')::BIGINT
        FROM jsonb_array_elements(COALESCE(p_direcciones, '[]'::jsonb)) AS d
        WHERE COALESCE((d->>'id')::BIGINT, 0) > 0
      );

    -- Update (id > 0) o insert (id 0/null) de cada dirección del payload.
    FOR v_dir IN
      SELECT d FROM jsonb_array_elements(COALESCE(p_direcciones, '[]'::jsonb)) AS d
    LOOP
      IF COALESCE((v_dir->>'id')::BIGINT, 0) > 0 THEN
        UPDATE "ClienteDireccion" SET
          "Direccion"             = v_dir->>'Direccion',
          "Telefono"              = NULLIF(v_dir->>'Telefono', ''),
          "Contacto"              = v_dir->>'Contacto',
          "bPrincipal"            = COALESCE((v_dir->>'bPrincipal')::BOOLEAN, false),
          "IdUsuarioModificacion" = NULLIF((v_dir->>'IdUsuarioModificacion')::TEXT, '')::BIGINT,
          "FechaModificacion"     = COALESCE(NULLIF(v_dir->>'FechaModificacion', '')::TIMESTAMPTZ, NOW())
        WHERE id = (v_dir->>'id')::BIGINT
          AND "IdCliente" = p_id_cliente
          AND "IdTenant"  = p_id_tenant;
      ELSE
        INSERT INTO "ClienteDireccion" (
          "Direccion", "Telefono", "Contacto", "bPrincipal",
          "IdCliente", "IdTenant", "Estado", "IdUsuarioCreacion"
        ) VALUES (
          v_dir->>'Direccion',
          NULLIF(v_dir->>'Telefono', ''),
          v_dir->>'Contacto',
          COALESCE((v_dir->>'bPrincipal')::BOOLEAN, false),
          p_id_cliente,
          p_id_tenant,
          1,
          NULLIF((v_dir->>'IdUsuarioCreacion')::TEXT, '')::BIGINT
        );
      END IF;
    END LOOP;

    RETURN jsonb_build_object('ok', true);

  END IF;

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

-- ---------------------------------------------------------------------
-- 2. guardar_producto_con_kardex
--    Alta de producto + (si hay cantidad inicial y sucursal activa)
--    ProductoStock de la sucursal + movimiento "Stock inicial" (tipo 2),
--    todo en una transacción. Réplica exacta de lo que hacía el route.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guardar_producto_con_kardex(
  p_producto   JSONB,
  p_id_tenant  INT,
  p_id_negocio BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_id_producto BIGINT;
  v_cantidad    NUMERIC;
  v_id_usuario  BIGINT;
  v_result      JSONB;
BEGIN
  IF COALESCE(btrim(p_producto->>'Nombre'), '') = '' THEN
    RAISE EXCEPTION 'Nombre requerido';
  END IF;
  IF NULLIF(p_producto->>'PrecioVenta', '') IS NULL THEN
    RAISE EXCEPTION 'PrecioVenta requerido';
  END IF;

  v_cantidad   := COALESCE(NULLIF(p_producto->>'Cantidad', '')::NUMERIC, 0);
  v_id_usuario := NULLIF((p_producto->>'IdUsuarioCreacion')::TEXT, '')::BIGINT;

  INSERT INTO "Producto" (
    "Nombre", "PrecioCosto", "PrecioVenta", "Cantidad", "FechaVencimiento",
    "IdCategoria", "bActivoVenta", "IdTenant", "Estado", "IdUsuarioCreacion"
  ) VALUES (
    p_producto->>'Nombre',
    NULLIF(p_producto->>'PrecioCosto', '')::NUMERIC,
    (p_producto->>'PrecioVenta')::NUMERIC,
    NULLIF(p_producto->>'Cantidad', '')::NUMERIC,
    NULLIF(p_producto->>'FechaVencimiento', '')::DATE,
    COALESCE(NULLIF(p_producto->>'IdCategoria', '')::BIGINT, 0),
    COALESCE((p_producto->>'bActivoVenta')::BOOLEAN, true),
    p_id_tenant,
    1,
    v_id_usuario
  ) RETURNING id INTO v_id_producto;

  IF v_cantidad > 0 AND p_id_negocio IS NOT NULL THEN

    INSERT INTO "ProductoStock" (
      "IdProducto", "IdNegocio", "IdTenant", "Cantidad", "IdUsuarioCreacion"
    ) VALUES (
      v_id_producto, p_id_negocio, p_id_tenant, v_cantidad, v_id_usuario
    )
    ON CONFLICT ("IdProducto", "IdNegocio")
    DO UPDATE SET "Cantidad" = EXCLUDED."Cantidad";

    INSERT INTO "ProductoMovimiento" (
      "IdProducto", "TipoMovimiento", "Cantidad", "StockAnterior", "StockNuevo",
      "IdDocumento", "Observacion", "Fecha", "IdTenant", "IdNegocio",
      "IdUsuarioCreacion"
    ) VALUES (
      v_id_producto,
      2,                -- Compra / Ingreso (stock inicial)
      v_cantidad,
      0,
      v_cantidad,
      NULL,
      'Stock inicial',
      NOW(),
      p_id_tenant,
      p_id_negocio,
      v_id_usuario
    );

  END IF;

  SELECT to_jsonb(p.*) FROM "Producto" p WHERE p.id = v_id_producto INTO v_result;
  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;
