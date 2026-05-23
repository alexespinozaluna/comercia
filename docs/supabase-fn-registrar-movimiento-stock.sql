-- Migration: fn_registrar_movimiento_stock
-- Creates a Supabase function that atomically registers a stock movement
-- and updates the product's Cantidad based on the movement type's operation.
--
-- Operation logic (Operacion always UPPERCASE):
--   INGRESO  → adds Cantidad to product stock
--   SALIDA   → subtracts Cantidad from product stock
--   AJUSTE   → sets product stock to StockNuevo (explicit value)
--
-- TipoMovimiento mapping (defined in app types):
--   1 = Venta            → SALIDA
--   2 = Compra           → INGRESO
--   3 = Fabricación      → INGRESO
--   4 = Merma / Daño     → SALIDA
--   5 = Vencimiento      → SALIDA
--   6 = Inventario Físico → AJUSTE (sets stock to StockNuevo)

CREATE OR REPLACE FUNCTION fn_registrar_movimiento_stock(
  p_id_producto INT,
  p_tipo_movimiento INT,
  p_cantidad INT,
  p_stock_anterior INT,
  p_stock_nuevo INT,
  p_id_tenant INT,
  p_id_documento INT DEFAULT NULL,
  p_id_usuario INT DEFAULT NULL,
  p_observacion TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_producto_cantidad INT;
  v_operacion TEXT;
  v_result JSONB;
BEGIN
  -- Determine operation based on TipoMovimiento (Operacion always UPPERCASE)
  CASE p_tipo_movimiento
    WHEN 1 THEN v_operacion := 'SALIDA';       -- Venta
    WHEN 2 THEN v_operacion := 'INGRESO';      -- Compra
    WHEN 3 THEN v_operacion := 'INGRESO';      -- Fabricación
    WHEN 4 THEN v_operacion := 'SALIDA';        -- Merma / Daño
    WHEN 5 THEN v_operacion := 'SALIDA';        -- Vencimiento
    WHEN 6 THEN v_operacion := 'AJUSTE';        -- Inventario Físico (sets to StockNuevo)
    ELSE v_operacion := 'SALIDA';
  END CASE;

  -- Insert the movement record
  INSERT INTO "ProductoMovimiento" (
    "IdProducto", "TipoMovimiento", "Cantidad",
    "StockAnterior", "StockNuevo",
    "IdDocumento", "IdUsuario", "Observacion",
    "Fecha", "IdTenant"
  ) VALUES (
    p_id_producto, p_tipo_movimiento, p_cantidad,
    p_stock_anterior, p_stock_nuevo,
    p_id_documento, p_id_usuario, p_observacion,
    NOW(), p_id_tenant
  );

  -- Update product stock based on operation
  IF v_operacion = 'INGRESO' THEN
    UPDATE "Producto"
    SET "Cantidad" = "Cantidad" + p_cantidad
    WHERE id = p_id_producto AND "IdTenant" = p_id_tenant;
  ELSIF v_operacion = 'SALIDA' THEN
    UPDATE "Producto"
    SET "Cantidad" = "Cantidad" - p_cantidad
    WHERE id = p_id_producto AND "IdTenant" = p_id_tenant;
  ELSIF v_operacion = 'AJUSTE' THEN
    UPDATE "Producto"
    SET "Cantidad" = p_stock_nuevo
    WHERE id = p_id_producto AND "IdTenant" = p_id_tenant;
  END IF;

  -- Return result
  SELECT "Cantidad" INTO v_producto_cantidad
  FROM "Producto" WHERE id = p_id_producto;

  v_result := jsonb_build_object(
    'ok', true,
    'operacion', v_operacion,
    'stock_anterior', p_stock_anterior,
    'stock_nuevo', p_stock_nuevo,
    'cantidad_actual', v_producto_cantidad
  );

  RETURN v_result;
END;
$$;

-- Grant execute permission to anon role (custom JWT auth, not Supabase Auth)
GRANT EXECUTE ON FUNCTION fn_registrar_movimiento_stock TO anon;