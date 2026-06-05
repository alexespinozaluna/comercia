# Rediseño de lista de productos en detalle de venta

Fecha: 2026-06-05
Alcance: `src/app/venta-detalle/[id]/page.tsx` (bloque "Items")

## Contexto

La página `/venta-detalle/{id}` mostraba los productos del documento como una
**tabla grid de 4 columnas** (Producto / Cant. / Precio / Total). En móvil las
columnas de ancho fijo (`w-10`, `w-20`) apretaban los números y el nombre del
producto se cortaba con `truncate`.

## Decisión

Cambiar la tabla por una **lista tipo card** con avatar, alineada con el estilo
del resto de la app (mismo patrón aplicado en `/deuda`).

### Layout por ítem

```
[icono]  Nombre del producto                 Total
         {cantidad} und    Precio U. {precio}   ← línea chica, muted
```

- **Avatar**: icono `Package` (lucide) dentro de círculo `bg-brand-surface`,
  `h-10 w-10`, `shrink-0`. Se descartó usar iniciales del producto.
- **Nombre**: `flex-1`, **sin `truncate`** (hace wrap si es largo).
- **Total**: a la derecha de la primera línea, `font-semibold tabular-nums`.
- **Segunda línea** (`text-xs text-muted-foreground`): `{cantidad} und` +
  `Precio U. {precio}`, con `cantidadString` / `numToString`.
- Se conserva la fila **Total** al pie y se renombró el header a "Productos".

## Notas

- No hay imagen de producto en `DocumentoItem`, por eso el avatar es un icono
  genérico y no una foto.
- Sin cambios en datos ni API; es solo presentación.
