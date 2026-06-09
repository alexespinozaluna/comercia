# Reconstrucción del kardex de ventas — limpieza de duplicados

**Fecha:** 2026-06-09
**Script:** `supabase/script/reconstruir-kardex-ventas-2026-06-09.sql`
**Relacionado:** `docs/fix-kardex-duplicacion-y-anulacion-2026-06-08.md`

## Síntoma

`ProductoMovimiento` con movimientos de venta duplicados (mismo `IdDocumento` +
`IdProducto` repetido 2–4 veces, todos `TipoMovimiento = 1`) y stock a negativo.

## Causa

La corrupción histórica ya descrita en el fix del 2026-06-08: editar una venta
hacía "borrar todos + reinsertar todos" los items y el trigger viejo solo
reaccionaba a `INSERT`, así que cada edición agregaba un juego extra de
movimientos tipo 1 sin devolver stock. La canasta fusiona por `IdProducto`
(`use-basket.ts`), por lo que **una venta nunca tiene el mismo producto dos
veces**: cualquier `count > 1` por (documento, producto) es duplicado real.

El origen ya está corregido (frontend enhebra el `id` real del item + migración
`20260607020000` con trigger simétrico). Este script repara los **datos
históricos** que quedaron torcidos.

## Enfoque: reconstruir desde `DocumentoItem`

1. **STEP 0** — Respaldo completo de `ProductoMovimiento` y `ProductoStock`
   (`_backup_*_20260609`). Reversible.
2. **STEP 1** — Borrar todos los movimientos ligados a documentos de venta
   (tipo-1 duplicados + tipo-7 anulación de ventas).
3. **STEP 2** — Reinsertar **un** movimiento tipo 1 por item activo (`Estado=1`)
   de cada venta activa, con su cantidad actual y `Fecha = FechaEmision`.
4. **STEP 4** — Recalcular la cadena `StockAnterior→StockNuevo` de todo el kardex
   por (producto, sucursal), cronológico. `Inventario Físico` (tipo 6) es ancla:
   su `StockNuevo` es el conteo físico absoluto, se respeta; se recalcula su
   `Cantidad` como `|conteo − saldo previo|`.
5. **STEP 5 (opcional)** — Sincronizar `ProductoStock` al saldo final
   recomputado. Asume que compras/ajustes están bien registrados.

Todo corre en una transacción; nada persiste hasta `COMMIT`.

## Decisiones

- **Ventas/items anulados (`Estado=0`) no dejan movimiento.** En la verdad
  presente no descuentan stock, así que el kardex no muestra ni la venta anulada
  ni su reversa. (Si se quisiera conservar el rastro venta + anulación, habría
  que reinsertar también los tipo-7; no es lo que hace este script.)
- **STEP 4 es necesario**, no cosmético: sin él los movimientos reinsertados
  quedarían con `Stock: 0 → 0`. Al quitar las salidas duplicadas, el saldo final
  recomputado debería **dejar de ser negativo** por sí solo.
- **STEP 5 es opcional** porque sobrescribir `ProductoStock` asume que todas las
  compras/ajustes están bien registradas. Alternativa segura: fijar stock con
  **Inventario Físico** desde la app (Stock → Ajuste → Inventario Físico).

## Caveat

Si un producto **no** tiene movimiento inicial (tipo 2 "Stock inicial") y su
stock arrancó en algo distinto de 0 sin registrarlo, su cadena partirá de 0
hasta el primer Inventario Físico que la ancle.

## Verificación post-ejecución

```sql
-- Debe devolver 0 filas:
SELECT pm."IdDocumento", pm."IdProducto", COUNT(*)
FROM "ProductoMovimiento" pm
JOIN "Documento" d ON d.id = pm."IdDocumento"
WHERE d."IdTipoDocumento" = 1
GROUP BY pm."IdDocumento", pm."IdProducto"
HAVING COUNT(*) > 1;
```
