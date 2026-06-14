-- =====================================================================
-- MULTI-SUCURSAL — CORRECCIÓN de la Fase 1
-- =====================================================================
-- La Fase 1 (20260528000000) puso IdNegocio NOT NULL ANTES de actualizar
-- los caminos de escritura, que todavía no envían IdNegocio:
--   * guardar_venta_con_items  → INSERT Documento/DocumentoItem
--   * registrar_abono          → INSERT Documento/DocumentoItem
--   * cajaService.abrirCaja    → INSERT Caja
--   * fn_registrar_movimiento_stock → INSERT ProductoMovimiento
-- Con NOT NULL, todas esas inserciones fallan (violación NOT NULL).
--
-- Esta migración relaja IdNegocio a NULLABLE para que la app siga
-- funcionando durante las Fases 2-3. Se mantiene: la columna, las FK
-- (admiten NULL), el backfill ya hecho y la tabla ProductoStock.
--
-- El NOT NULL se RE-APLICARÁ en la Fase 3, cuando las RPC/inserts/trigger
-- ya pongan IdNegocio, junto con un re-backfill de las filas creadas en
-- el intervalo (que tendrán IdNegocio NULL).
--
-- Idempotente: DROP NOT NULL no falla si ya es nullable.
-- =====================================================================

ALTER TABLE "Documento"          ALTER COLUMN "IdNegocio" DROP NOT NULL;
ALTER TABLE "DocumentoItem"      ALTER COLUMN "IdNegocio" DROP NOT NULL;
ALTER TABLE "Caja"               ALTER COLUMN "IdNegocio" DROP NOT NULL;
ALTER TABLE "ProductoMovimiento" ALTER COLUMN "IdNegocio" DROP NOT NULL;
