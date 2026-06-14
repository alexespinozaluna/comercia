-- =============================================================
-- Fix: al ELIMINAR (soft-delete, Estado=0) un abono, el Saldo de la
-- venta no se restauraba, porque el trigger sumaba MontoAbono de TODOS
-- los items sin filtrar por Estado.
--
-- Solución: el trigger fn_actualizar_saldo_total_abono ahora suma solo
-- los items ACTIVOS (Estado = 1). Así:
--   * soft-delete de un abono (item Estado→0) → su monto deja de contar
--     → el Saldo de la venta se restaura automáticamente.
--   * restaurar el abono (item Estado→1) → vuelve a contar → Saldo baja
--     de nuevo. Coherente con el flujo soft-delete + restaurar de la app.
--
-- No se modifica la ruta DELETE (sigue haciendo soft-delete). No se toca
-- la PROCEDURE actualizar_saldo_total_abono(integer): no la usa la app
-- (solo aparece en docs); el mecanismo activo es este trigger.
--
-- Incluye un backfill correctivo que recalcula Saldo/TotalAbono de toda
-- venta referenciada por algún abono, usando solo items activos. Hoy es
-- un no-op (no hay abonos soft-deleted), pero deja los datos consistentes.
-- =============================================================

CREATE OR REPLACE FUNCTION public.fn_actualizar_saldo_total_abono()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    pMontoAbono NUMERIC := 0;
    pIdDocumentoRef INT;
BEGIN
    pIdDocumentoRef := COALESCE(NEW."IdDocumentoRef", OLD."IdDocumentoRef", 0);

    IF COALESCE(pIdDocumentoRef, 0) <= 0 THEN
        RETURN NULL;
    END IF;

    -- Suma SOLO los abonos activos (Estado = 1)
    SELECT COALESCE(SUM("MontoAbono"), 0)
    INTO pMontoAbono
    FROM "DocumentoItem"
    WHERE "IdDocumentoRef" = pIdDocumentoRef
      AND "Estado" = 1;

    UPDATE "Documento"
    SET "TotalAbono" = pMontoAbono,
        "Saldo" = "Total" - pMontoAbono
    WHERE "id" = pIdDocumentoRef;

    RETURN NULL;
END;
$$;

-- Backfill correctivo: recalcula con la nueva regla (solo items activos)
UPDATE "Documento" d
SET "TotalAbono" = COALESCE(s.suma, 0),
    "Saldo"      = d."Total" - COALESCE(s.suma, 0)
FROM (
  SELECT DISTINCT "IdDocumentoRef" AS ref
  FROM "DocumentoItem"
  WHERE "IdDocumentoRef" IS NOT NULL AND "IdDocumentoRef" > 0
) refs
LEFT JOIN (
  SELECT "IdDocumentoRef" AS ref, SUM("MontoAbono") AS suma
  FROM "DocumentoItem"
  WHERE "IdDocumentoRef" IS NOT NULL AND "IdDocumentoRef" > 0
    AND "Estado" = 1
  GROUP BY "IdDocumentoRef"
) s ON s.ref = refs.ref
WHERE d.id = refs.ref;
