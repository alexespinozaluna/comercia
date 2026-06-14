-- =====================================================================
-- KARDEX — Contabilidad de stock SIMÉTRICA (INSERT / UPDATE / DELETE)
-- =====================================================================
-- Problema que resuelve:
--   El trigger fn_registrar_movimiento_stock solo reaccionaba a INSERT de
--   DocumentoItem. Por eso:
--     * Editar una venta (hard-delete + re-insert de items) descontaba stock
--       de nuevo sin devolver el de los items borrados  → DUPLICA movimientos.
--     * Eliminar (soft-delete, Estado→0) una venta NO devolvía el stock.
--     * Cambiar la cantidad de un item (UPDATE) no ajustaba el stock.
--   Resultado: stock a la deriva (llegó a negativo) y movimientos duplicados.
--
-- Solución:
--   El trigger ahora corre AFTER INSERT OR UPDATE OR DELETE y calcula el
--   cambio en la "deducción efectiva" del item:
--       eff(item) = (Estado = 1) ? Cantidad : 0      -- lo que la venta resta
--   stock_change = -(eff_nuevo - eff_viejo). Es decir:
--     * alta de item / restaurar / subir cantidad   → stock baja  (Venta, tipo 1)
--     * borrar item / soft-delete / bajar cantidad   → stock sube  (Anulación, tipo 7)
--   Cada cambio queda registrado en ProductoMovimiento (kardex) y ajusta
--   ProductoStock de la sucursal.
--
--   Solo aplica a documentos de VENTA (IdTipoDocumento = 1). Los ajustes
--   (tipo 5) registran su propio movimiento desde /api/ajustes, y el alta de
--   producto siembra el "Stock inicial" (tipo 2) directamente; ninguno pasa
--   por este trigger.
--
-- Supersede la definición de fn_registrar_movimiento_stock de la migración
-- 20260607010000 (que solo corregía el tipo a 1). El backfill de aquella
-- migración sigue siendo válido.
--
-- Idempotente.
-- =====================================================================

-- 0. Catálogo: tipo 7 = Anulación venta (devolución a stock, INGRESO).
INSERT INTO "TipoMovimiento" ("Id", "Descripcion", "Operacion", "Efecto", "Estado")
VALUES (7, 'Anulación venta', 'INGRESO', 'Suma', 1)
ON CONFLICT ("Id") DO UPDATE
  SET "Descripcion" = EXCLUDED."Descripcion",
      "Operacion"   = EXCLUDED."Operacion",
      "Efecto"      = EXCLUDED."Efecto",
      "Estado"      = EXCLUDED."Estado";

-- 1. Helper: aplica un delta de stock a (producto, sucursal) y deja el
--    movimiento en el kardex. delta > 0 = entra stock (devolución, tipo 7);
--    delta < 0 = sale stock (venta, tipo 1). delta = 0 → no-op.
CREATE OR REPLACE FUNCTION fn_aplicar_delta_stock(
  p_id_producto  BIGINT,
  p_id_negocio   BIGINT,
  p_id_tenant    BIGINT,
  p_delta        NUMERIC,
  p_id_documento BIGINT
) RETURNS void AS $$
DECLARE
  v_stock NUMERIC;
  v_tipo  INT;
BEGIN
  IF p_delta = 0
     OR p_id_producto IS NULL OR p_id_producto <= 0
     OR p_id_negocio IS NULL THEN
    RETURN;
  END IF;

  SELECT "Cantidad" INTO v_stock
  FROM "ProductoStock"
  WHERE "IdProducto" = p_id_producto AND "IdNegocio" = p_id_negocio;
  v_stock := COALESCE(v_stock, 0);

  v_tipo := CASE WHEN p_delta < 0 THEN 1   -- Venta (SALIDA)
                 ELSE 7 END;               -- Anulación venta (INGRESO)

  INSERT INTO "ProductoMovimiento" (
    "IdTenant", "IdNegocio", "IdProducto", "TipoMovimiento", "Cantidad",
    "StockAnterior", "StockNuevo", "IdDocumento", "Fecha"
  ) VALUES (
    p_id_tenant, p_id_negocio, p_id_producto, v_tipo, ABS(p_delta),
    v_stock, v_stock + p_delta, p_id_documento, NOW()
  );

  INSERT INTO "ProductoStock" ("IdProducto", "IdNegocio", "IdTenant", "Cantidad")
  VALUES (p_id_producto, p_id_negocio, p_id_tenant, v_stock + p_delta)
  ON CONFLICT ("IdProducto", "IdNegocio")
  DO UPDATE SET "Cantidad" = EXCLUDED."Cantidad";
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger simétrico sobre DocumentoItem.
CREATE OR REPLACE FUNCTION fn_registrar_movimiento_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_old_eff NUMERIC;
  v_new_eff NUMERIC;
  v_doc_id  BIGINT;
BEGIN
  -- Documento relevante según la operación.
  v_doc_id := COALESCE(NEW."IdDocumento", OLD."IdDocumento");
  IF v_doc_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Solo ventas.
  IF NOT EXISTS (
    SELECT 1 FROM "Documento" WHERE id = v_doc_id AND "IdTipoDocumento" = 1
  ) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_new_eff := CASE WHEN NEW."Estado" = 1 THEN NEW."Cantidad" ELSE 0 END;
    PERFORM fn_aplicar_delta_stock(
      NEW."IdProducto", NEW."IdNegocio", NEW."IdTenant", -v_new_eff, NEW."IdDocumento");
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_old_eff := CASE WHEN OLD."Estado" = 1 THEN OLD."Cantidad" ELSE 0 END;
    PERFORM fn_aplicar_delta_stock(
      OLD."IdProducto", OLD."IdNegocio", OLD."IdTenant", v_old_eff, OLD."IdDocumento");
    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    v_old_eff := CASE WHEN OLD."Estado" = 1 THEN OLD."Cantidad" ELSE 0 END;
    v_new_eff := CASE WHEN NEW."Estado" = 1 THEN NEW."Cantidad" ELSE 0 END;

    IF COALESCE(OLD."IdProducto", 0) = COALESCE(NEW."IdProducto", 0) THEN
      -- Mismo producto: delta neto.
      PERFORM fn_aplicar_delta_stock(
        NEW."IdProducto", NEW."IdNegocio", NEW."IdTenant",
        (v_old_eff - v_new_eff), NEW."IdDocumento");
    ELSE
      -- Cambió el producto: devolver al viejo, descontar al nuevo.
      PERFORM fn_aplicar_delta_stock(
        OLD."IdProducto", OLD."IdNegocio", OLD."IdTenant", v_old_eff, NEW."IdDocumento");
      PERFORM fn_aplicar_delta_stock(
        NEW."IdProducto", NEW."IdNegocio", NEW."IdTenant", -v_new_eff, NEW."IdDocumento");
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3. Recrear el trigger para que reaccione a las tres operaciones.
DROP TRIGGER IF EXISTS trg_movimiento_stock ON "DocumentoItem";
CREATE TRIGGER trg_movimiento_stock
AFTER INSERT OR UPDATE OR DELETE ON "DocumentoItem"
FOR EACH ROW
EXECUTE FUNCTION fn_registrar_movimiento_stock();
