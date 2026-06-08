# Fix Kardex — duplicación de movimientos al editar + anular stock al eliminar

**Fecha:** 2026-06-08
**Migración:** `supabase/migrations/20260607020000_kardex_stock_simetrico.sql`

## Síntomas

- En el kardex de un producto, un mismo documento de venta aparecía **dos (o
  más) veces** con el mismo descuento (p. ej. `#00844  −7` repetido).
- El stock cayó a **negativo profundo** (−1.144) sin ventas que lo justifiquen.

## Causa raíz (dos bugs que se potencian)

### Bug 1 — Frontend: el `id` del item no se conservaba al editar
`use-pos-transaction.ts` cargaba los items de una venta al basket sin su `id`
real, y al guardar mandaba `id: 0` para todos. El diff de `documento-service.ts`
clasifica por `id`:

```ts
const toUpdate = items.filter((i) => i.id && i.id > 0);   // → vacío
const toAdd    = items.filter((i) => !i.id || i.id <= 0); // → TODOS
const toDeleteIds = originalItemIds.filter(...);          // → TODOS los viejos
```

→ Cada edición se traducía en **"borrar todos + reinsertar todos"**.

### Bug 2 — BD: el trigger de stock solo reaccionaba a INSERT
`fn_registrar_movimiento_stock` corría `AFTER INSERT`. Así, el "borrar todos"
del diff (hard-delete) **no devolvía stock**, y el "reinsertar todos" lo
**descontaba otra vez** → movimientos duplicados y stock a la deriva. Lo mismo
al **eliminar** una venta (soft-delete, `Estado→0`): nunca devolvía el stock.

## Solución

### A. Frontend — enhebrar el `id` real del item
- `use-basket.ts`: `BasketItemLocal` ahora lleva `id?: number`.
- `use-pos-transaction.ts`: al hidratar usa `id: item.id`; al guardar
  `id: b.id ?? 0`. Así el diff reconoce items existentes (UPDATE) y solo
  inserta los realmente nuevos.

### B. BD — trigger de stock SIMÉTRICO
Migración `20260607020000`. El trigger corre `AFTER INSERT OR UPDATE OR DELETE`
y calcula el cambio en la **deducción efectiva** del item:

```
eff(item) = (Estado = 1) ? Cantidad : 0
stock_change = -(eff_nuevo - eff_viejo)
```

- alta / restaurar / subir cantidad → stock baja → movimiento **Venta (tipo 1)**
- borrar / soft-delete / bajar cantidad → stock sube → movimiento **Anulación
  venta (tipo 7, nuevo, INGRESO)**

Helper `fn_aplicar_delta_stock(...)` aplica el delta a `ProductoStock` y deja el
registro en `ProductoMovimiento`. Solo actúa sobre documentos de venta
(`IdTipoDocumento = 1`); ajustes (tipo 5) y stock inicial registran su propio
movimiento por otra vía.

Nuevo catálogo: `7 = Anulación venta` (INGRESO/Suma). Añadido al seed
`supabase-tipo-movimiento.sql`, a `TIPO_MOVIMIENTO` en `database.ts`, y con
estilo propio (ícono ↺ verde, signo "+") en el kardex.

## Estado

- [x] A — frontend (versionado en git).
- [ ] B — migración `20260607020000` **pendiente de aplicar** en Supabase.
- [ ] Reparar el stock histórico (ver abajo).

## Reparar el stock ya corrupto (−1.144)

Los movimientos viejos siguen duplicados, así que recalcular automáticamente
sería poco fiable (los inventarios físicos fijan valores absolutos y rompen
cualquier suma histórica). Vía recomendada:

1. Aplicar la migración `20260607020000` (corrige de aquí en adelante).
2. **Inventario Físico** desde la app (Stock → Ajuste → Inventario Físico):
   cuentas el stock real y la app lo fija por sucursal, dejando el ajuste
   auditado en el kardex. Sin tocar la BD a mano.

Diagnóstico en `supabase/script/diagnostico-stock-kardex.sql` (solo SELECT):
lista duplicados por (documento, producto) y los stocks negativos.

> Limpiar los movimientos duplicados históricos (para que el kardex no muestre
> la venta dos veces) es cirugía de datos aparte; se hace caso por caso con
> respaldo si se decide hacerlo.
