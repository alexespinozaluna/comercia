-- =====================================================================
-- Bloqueo de edición/eliminación de movimientos en CAJA CERRADA
-- =====================================================================
-- Regla (genérica, todo movimiento con IdCaja, sin importar el método):
--   No se puede MODIFICAR (campos de negocio) ni ELIMINAR un Documento cuya
--   caja (IdCaja) ya esté cerrada (Caja.Estado = 0). Mientras la caja esté
--   abierta sí se puede (el arqueo se recalcula en vivo).
--
-- ⚠️ Cuidado con el recálculo: el trigger fn_actualizar_saldo_total_abono
-- ACTUALIZA Saldo/TotalAbono de documentos (incluso de cajas cerradas) cuando
-- se registra/anula un abono sobre una venta vieja. Eso es legítimo y NO debe
-- bloquearse. Por eso este trigger SOLO bloquea cuando cambian CAMPOS DE
-- NEGOCIO (Total, IdCliente, Concepto, FechaEmision, IdMetodoPago, Estado),
-- nunca cuando solo cambian Saldo/TotalAbono (recálculo interno).
--
-- Idempotente.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.fn_bloquear_caja_cerrada()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_cerrada BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."IdCaja" IS NOT NULL THEN
      SELECT (c."Estado" = 0) INTO v_cerrada FROM "Caja" c WHERE c.id = OLD."IdCaja";
      IF COALESCE(v_cerrada, false) THEN
        RAISE EXCEPTION 'No se puede eliminar un movimiento de una caja cerrada';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE: solo bloquear si cambia algún campo de negocio (no el recálculo)
  IF OLD."IdCaja" IS NOT NULL
     AND ( NEW."Total"         IS DISTINCT FROM OLD."Total"
        OR NEW."IdCliente"     IS DISTINCT FROM OLD."IdCliente"
        OR NEW."Concepto"      IS DISTINCT FROM OLD."Concepto"
        OR NEW."FechaEmision"  IS DISTINCT FROM OLD."FechaEmision"
        OR NEW."IdMetodoPago"  IS DISTINCT FROM OLD."IdMetodoPago"
        OR NEW."Estado"        IS DISTINCT FROM OLD."Estado" )
  THEN
    SELECT (c."Estado" = 0) INTO v_cerrada FROM "Caja" c WHERE c.id = OLD."IdCaja";
    IF COALESCE(v_cerrada, false) THEN
      RAISE EXCEPTION 'No se puede modificar un movimiento de una caja cerrada';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_caja_cerrada ON "Documento";
CREATE TRIGGER trg_bloquear_caja_cerrada
  BEFORE UPDATE OR DELETE ON "Documento"
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_bloquear_caja_cerrada();
