-- =====================================================================
-- KARDEX — Ajustes: revertir stock al ELIMINAR / ANULAR (no en INSERT)
-- =====================================================================
-- Hasta ahora el trigger fn_registrar_movimiento_stock solo actuaba sobre
-- VENTAS (IdTipoDocumento = 1). Los ajustes (tipo 5: Baja e Inventario Físico)
-- aplican su efecto de stock a mano desde /api/ajustes en el INSERT, pero al
-- borrarlos/anularlos NADIE devolvía el stock → quedaba inconsistente.
--
-- Decisión (acordada): el trigger maneja ajustes SOLO en DELETE / anulación.
--   * INSERT de un item de ajuste → NO hace nada (el API ya aplicó stock +
--     movimiento; meterse aquí duplicaría el conteo).
--   * DELETE (hard) del item       → revierte el stock y BORRA el movimiento.
--   * UPDATE Estado 1→0 (anular)   → revierte el stock (deja el movimiento).
--   * UPDATE Estado 0→1 (restaurar)→ re-aplica el stock.
--
-- El "efecto" a revertir se lee del propio ProductoMovimiento del ajuste:
--   delta = StockNuevo − StockAnterior   (negativo en Baja, +/− en Inventario)
-- revertir → ProductoStock -= delta ; restaurar → ProductoStock += delta.
-- Esto funciona igual para Baja (delta = −Cantidad) y para Inventario Físico
-- (delta = contado − anterior), porque sobre el saldo corrido ambos son deltas.
--
-- La lógica de VENTAS (tipo 1) queda EXACTAMENTE igual.
--
-- Idempotente. Supersede la definición de fn_registrar_movimiento_stock de la
-- migración 20260607020000 (que solo manejaba ventas).
-- =====================================================================

-- 1. Helper: revierte (o re-aplica) en ProductoStock el efecto del ajuste,
--    leído del ProductoMovimiento de ese (documento, producto).
CREATE OR REPLACE FUNCTION fn_revertir_ajuste_stock(
  p_id_documento BIGINT,
  p_id_producto  BIGINT,
  p_revertir     BOOLEAN   -- TRUE = revertir (anular) · FALSE = re-aplicar (restaurar)
) RETURNS void AS $$
DECLARE
  v_mov   RECORD;
  v_delta NUMERIC;
  v_stock NUMERIC;
BEGIN
  -- Movimiento del ajuste para este (documento, producto).
  SELECT * INTO v_mov
  FROM "ProductoMovimiento"
  WHERE "IdDocumento" = p_id_documento AND "IdProducto" = p_id_producto
  ORDER BY id DESC
  LIMIT 1;

  IF v_mov.id IS NULL OR v_mov."IdNegocio" IS NULL THEN
    RETURN;   -- nada que revertir (o sin sucursal: stock legacy, no aplica aquí)
  END IF;

  v_delta := v_mov."StockNuevo" - v_mov."StockAnterior";   -- efecto original

  SELECT "Cantidad" INTO v_stock
  FROM "ProductoStock"
  WHERE "IdProducto" = p_id_producto AND "IdNegocio" = v_mov."IdNegocio";
  v_stock := COALESCE(v_stock, 0);

  IF p_revertir THEN
    v_stock := v_stock - v_delta;   -- deshacer
  ELSE
    v_stock := v_stock + v_delta;   -- re-aplicar
  END IF;

  INSERT INTO "ProductoStock" ("IdProducto", "IdNegocio", "IdTenant", "Cantidad")
  VALUES (p_id_producto, v_mov."IdNegocio", v_mov."IdTenant", v_stock)
  ON CONFLICT ("IdProducto", "IdNegocio")
  DO UPDATE SET "Cantidad" = EXCLUDED."Cantidad";
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger: ventas (tipo 1) como antes + ajustes (tipo 5) en delete/anulación.
CREATE OR REPLACE FUNCTION fn_registrar_movimiento_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_old_eff  NUMERIC;
  v_new_eff  NUMERIC;
  v_doc_id   BIGINT;
  v_tipo_doc INT;
BEGIN
  v_doc_id := COALESCE(NEW."IdDocumento", OLD."IdDocumento");
  IF v_doc_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT "IdTipoDocumento" INTO v_tipo_doc FROM "Documento" WHERE id = v_doc_id;

  -- ================= VENTAS (tipo 1): lógica simétrica =================
  IF v_tipo_doc = 1 THEN
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
        PERFORM fn_aplicar_delta_stock(
          NEW."IdProducto", NEW."IdNegocio", NEW."IdTenant",
          (v_old_eff - v_new_eff), NEW."IdDocumento");
      ELSE
        PERFORM fn_aplicar_delta_stock(
          OLD."IdProducto", OLD."IdNegocio", OLD."IdTenant", v_old_eff, NEW."IdDocumento");
        PERFORM fn_aplicar_delta_stock(
          NEW."IdProducto", NEW."IdNegocio", NEW."IdTenant", -v_new_eff, NEW."IdDocumento");
      END IF;
      RETURN NEW;
    END IF;
    RETURN NULL;
  END IF;

  -- ================= AJUSTES (tipo 5): solo delete / anulación =========
  IF v_tipo_doc = 5 THEN
    IF TG_OP = 'INSERT' THEN
      RETURN NEW;   -- el API /api/ajustes ya aplicó stock + movimiento

    ELSIF TG_OP = 'DELETE' THEN
      -- Solo devolver stock si el item estaba activo (si ya estaba anulado, el
      -- stock se devolvió en el UPDATE 1→0; evitar doble reversa).
      IF OLD."Estado" = 1 THEN
        PERFORM fn_revertir_ajuste_stock(v_doc_id, OLD."IdProducto", TRUE);
      END IF;
      -- Borrado físico → limpiar el movimiento para que el kardex no muestre
      -- un ajuste que ya no existe.
      DELETE FROM "ProductoMovimiento"
      WHERE "IdDocumento" = v_doc_id AND "IdProducto" = OLD."IdProducto";
      RETURN OLD;

    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD."Estado" = 1 AND NEW."Estado" = 0 THEN
        PERFORM fn_revertir_ajuste_stock(v_doc_id, NEW."IdProducto", TRUE);   -- anular
      ELSIF OLD."Estado" = 0 AND NEW."Estado" = 1 THEN
        PERFORM fn_revertir_ajuste_stock(v_doc_id, NEW."IdProducto", FALSE);  -- restaurar
      END IF;
      RETURN NEW;
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Otros tipos de documento: el trigger no toca stock.
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 3. El trigger ya existe (AFTER INSERT OR UPDATE OR DELETE ON DocumentoItem,
--    creado en 20260607020000). No hace falta recrearlo; basta el REPLACE de la
--    función. Se deja la recreación comentada por referencia:
-- DROP TRIGGER IF EXISTS trg_movimiento_stock ON "DocumentoItem";
-- CREATE TRIGGER trg_movimiento_stock
-- AFTER INSERT OR UPDATE OR DELETE ON "DocumentoItem"
-- FOR EACH ROW EXECUTE FUNCTION fn_registrar_movimiento_stock();
