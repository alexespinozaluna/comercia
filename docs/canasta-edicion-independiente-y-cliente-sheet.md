# Canasta: edición independiente cantidad/precio + selección de cliente en bottom sheet

Fecha: 2026-06-05
Alcance:
- `src/components/ventas/pos/CartItemEditSheet.tsx` (nuevo)
- `src/components/ventas/pos/cart/CartItemsList.tsx`
- `src/components/ventas/pos/CartSummary.tsx`
- `src/components/ventas/pos/ClientSelector.tsx`
- `src/components/ventas/cliente-selector-sheet.tsx`

## Requerimiento

1. En la canasta de nueva venta, **editar cantidad y editar precio deben ser
   independientes**: al ir a corregir la cantidad el usuario podía cambiar el
   precio por error (y viceversa), porque el editor los modificaba juntos.
2. La **selección de cliente** debe aparecer como un **sheet desde abajo** para
   que sea más visible.

## Decisiones (validadas con el usuario)

1. Edición: **dos bottom sheets separados** — uno para cantidad, otro para
   precio. Editores totalmente aislados.
2. Cliente: el bottom sheet permite **buscar y crear** cliente nuevo.

## Implementación

### 1. Edición independiente

- **Antes**: `CartItemDetailSheet` editaba cantidad + precio juntos con un único
  botón "Actualizar". Tocar la fila abría ese editor combinado.
- **Ahora**: nuevo `CartItemEditSheet` edita **un solo campo** (`field:
  "cantidad" | "precio"`). El botón confirma solo ese campo; el otro nunca se
  toca.
- `CartItemsList` expone dos zonas tocables independientes en la fila:
  - El número de cantidad (entre los botones −/+) abre el editor de cantidad.
  - El bloque "Precio U. $X ✎" abre el editor de precio.
  - Se mantienen los botones −/+ para ajustes rápidos de cantidad.
- `CartSummary` orquesta el estado `{ editItem, editField }` y renderiza
  `CartItemEditSheet`.
- `CartItemDetailSheet` (combinado) se **conserva** porque lo usa el dev-harness
  y su test E2E; ya no se usa en la app real.

### 2. Cliente en bottom sheet

- `ClienteSelectorSheet` pasó de `side="right"` a `side="bottom"` (con
  `rounded-t-2xl` y `max-h-[85vh]`). Ya tenía buscar + crear cliente; estaba sin
  usar y ahora se conecta.
- `ClientSelector`:
  - Sin cliente → botón "Seleccionar cliente" que abre el bottom sheet (antes
    era un buscador inline poco visible).
  - Con cliente → la card se mantiene; "Cambiar" abre el sheet para elegir otro;
    la "X" deselecciona.
  - Se eliminó el subcomponente inline `BuscadorDeClientes`.

### Limpieza colateral

- En `documento-service.getVentas` el cast pasó a `as unknown as Documento[]`
  (el embed con hint de FK rompe la inferencia del cliente tipado, mismo patrón
  que `getVentaConItem`) y se quitó un `console.log` de debug.

## Pendientes / próximas decisiones

- Evaluar si conviene eliminar `CartItemDetailSheet` + su harness/E2E y migrar el
  test al nuevo `CartItemEditSheet`.
