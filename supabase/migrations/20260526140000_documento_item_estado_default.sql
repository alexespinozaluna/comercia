-- =============================================================
-- DocumentoItem.Estado: fijar DEFAULT 1 y normalizar filas NULL.
--
-- modificar_venta_con_items inserta items nuevos SIN especificar "Estado";
-- con este DEFAULT esos items quedan activos (Estado = 1) automaticamente.
-- El UPDATE corrige filas historicas que pudieran haber quedado en NULL.
-- =============================================================

ALTER TABLE public."DocumentoItem"
  ALTER COLUMN "Estado" SET DEFAULT 1;

UPDATE public."DocumentoItem"
  SET "Estado" = 1
  WHERE "Estado" IS NULL;
