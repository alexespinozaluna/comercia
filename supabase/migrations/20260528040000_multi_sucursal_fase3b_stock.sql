-- =====================================================================
-- MULTI-SUCURSAL — FASE 3b: cutover de stock a ProductoStock
-- =====================================================================
-- El stock deja de vivir en Producto.Cantidad y pasa a
-- ProductoStock(IdProducto, IdNegocio).Cantidad (stock por sucursal,
-- catálogo compartido).
--
-- Este script cubre el TRIGGER de venta. El resto del cutover va en TS:
--   * ajustes  → lee/escribe ProductoStock de la sucursal activa.
--   * productos (alta) → siembra ProductoStock de la sucursal + movimiento.
--   * lecturas de producto → muestran el stock de la sucursal activa.
--
-- Producto.Cantidad queda como bandera "rastrea stock" (NULL = no rastrea)
-- y valor legacy; ya no es la fuente del stock.
--
-- Idempotente.
-- =====================================================================

CREATE OR REPLACE FUNCTION fn_registrar_movimiento_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_stock NUMERIC;
BEGIN
  -- Solo ventas (tipo 1) con producto real y sucursal definida.
  IF TG_OP = 'INSERT'
     AND NEW."IdDocumento" IS NOT NULL
     AND NEW."IdNegocio" IS NOT NULL
     AND COALESCE(NEW."IdProducto", 0) > 0 THEN

    IF EXISTS (
      SELECT 1 FROM "Documento"
      WHERE id = NEW."IdDocumento"
        AND "IdTipoDocumento" = 1
        AND "Estado" = 1
    ) THEN
      -- Stock actual de la sucursal (0 si aún no hay fila).
      SELECT "Cantidad" INTO v_stock
      FROM "ProductoStock"
      WHERE "IdProducto" = NEW."IdProducto" AND "IdNegocio" = NEW."IdNegocio";
      v_stock := COALESCE(v_stock, 0);

      INSERT INTO "ProductoMovimiento" (
        "IdTenant", "IdNegocio", "IdProducto", "TipoMovimiento", "Cantidad",
        "StockAnterior", "StockNuevo", "IdDocumento", "Fecha"
      ) VALUES (
        NEW."IdTenant", NEW."IdNegocio", NEW."IdProducto", 2, NEW."Cantidad",
        v_stock, v_stock - NEW."Cantidad", NEW."IdDocumento", NOW()
      );

      -- Stock por sucursal (crea la fila si no existe).
      INSERT INTO "ProductoStock" ("IdProducto", "IdNegocio", "IdTenant", "Cantidad")
      VALUES (NEW."IdProducto", NEW."IdNegocio", NEW."IdTenant", v_stock - NEW."Cantidad")
      ON CONFLICT ("IdProducto", "IdNegocio")
      DO UPDATE SET "Cantidad" = EXCLUDED."Cantidad";
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
