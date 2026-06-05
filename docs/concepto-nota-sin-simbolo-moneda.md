# Concepto/Nota automático sin símbolo de moneda

Fecha: 2026-06-05
Alcance:
- `src/lib/format.ts`
- `src/hooks/pos/use-basket.ts`

## Requerimiento

El concepto auto-generado para la Nota de la venta no debe incluir el símbolo
de moneda en el precio.

## Causa

`crearConcepto` (`use-basket.ts`) armaba la nota como
`"{Cantidad} {Descripcion} {numToString(PrecioVenta)}"`, y `numToString`
antepone `"$ "` (ej. `2 Coca Cola $ 1.500`).

## Cambio

- En `format.ts` se extrajo `formatNumero(value, format)` que devuelve el número
  formateado **sin** símbolo; `numToString` ahora reusa ese helper y solo agrega
  el prefijo `"$ "`. Mismo formato numérico de siempre (N0 por defecto).
- `crearConcepto` usa `formatNumero` → la nota queda `2 Coca Cola 1.500`.

Sin cambios de comportamiento en `numToString` ni en el resto de la app.
