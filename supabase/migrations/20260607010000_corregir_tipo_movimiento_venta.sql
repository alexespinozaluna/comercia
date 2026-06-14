-- =====================================================================
-- FIX — Kardex: el movimiento de stock por VENTA usaba TipoMovimiento=2
-- =====================================================================
-- El trigger fn_registrar_movimiento_stock (definido en la migración
-- 20260528040000_multi_sucursal_fase3b_stock) insertaba el movimiento de
-- venta con "TipoMovimiento" = 2.
--
-- Pero en el catálogo "TipoMovimiento" (supabase-tipo-movimiento.sql):
--     1 = Venta            → SALIDA / Resta   ✅ correcto para una venta
--     2 = Compra           → INGRESO / Suma   ❌ es lo que se guardaba
--
-- Consecuencia en el kardex (/producto/kardex/[id]): cada venta se mostraba
-- con la etiqueta "Compra", icono verde ↗ y signo "+", aunque el stock baja.
-- Además el filtro "Ingresos" mostraba las ventas y "Salidas" las ocultaba.
-- El stock sí se descontaba bien (el trigger lo calcula a mano), solo la
-- CLASIFICACIÓN del movimiento estaba equivocada.
--
-- Esta migración:
--   1. Recrea el trigger escribiendo TipoMovimiento = 1 (Venta / SALIDA).
--   2. Backfill: reclasifica a 1 los movimientos tipo 2 que en realidad
--      pertenecen a un Documento de venta (IdTipoDocumento = 1). Las compras
--      reales (no ligadas a una venta) se conservan como tipo 2.
--
-- Idempotente.
-- =====================================================================

-- 1. Recrear el trigger con el TipoMovimiento correcto (1 = Venta).
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
        NEW."IdTenant", NEW."IdNegocio", NEW."IdProducto", 1, NEW."Cantidad",
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

-- 2. Backfill correctivo: movimientos tipo 2 ligados a un Documento de venta
--    fueron en realidad ventas mal clasificadas → pasarlos a tipo 1.
UPDATE "ProductoMovimiento" pm
SET "TipoMovimiento" = 1
FROM "Documento" d
WHERE pm."IdDocumento" = d.id
  AND d."IdTipoDocumento" = 1
  AND pm."TipoMovimiento" = 2;
