# Propuesta: editar ventas en versión móvil (2026-06-12)

## Problema

Editar una venta (`venta-detalle` → "Editar" → `/venta-form/[id]`) siempre
monta el POS desktop (`PosShell`), también en el teléfono. El wizard móvil
(`/venta/nueva-movil`) solo sabe crear.

## Evaluación del estado actual

La lógica difícil de la edición ya existe en `use-pos-transaction.ts`:

- **Elegibilidad**: rechaza editar si `Estado === 0` (eliminada) o
  `TotalAbono > 0` (ya tiene abonos), con toast + redirect.
- **Hidratación**: fecha, `bCredito`, método, concepto, cliente con
  dirección preferida, y canasta preservando el `id` real de cada
  `DocumentoItem` + `originalItemIds` — base del diff UPDATE-vs-INSERT que
  evita duplicar kardex (ver fix-kardex-duplicacion-y-anulacion-2026-06-08).
- **Guardado**: `PUT /api/ventas/[id]` con `originalItemIds`. El backend
  no necesita cambios.

El wizard móvil ya reutiliza los mismos sub-hooks de `hooks/pos/` y su
payload ya mapea `id: b.id ?? 0` en los items: solo falta el modo edición.

## Propuesta

1. **Hook compartido `src/hooks/pos/use-venta-edicion.ts`**: extrae de
   `use-pos-transaction` la carga por id + elegibilidad + hidratación de los
   sub-hooks + `originalItemIds`. Lo consumen ambos flujos para que las
   reglas nunca diverjan entre desktop y móvil.
2. **Ruta `/venta/editar-movil/[id]`** que renderiza `VentaMovilWizard` con
   prop `idVenta`. En modo edición:
   - Aterriza en el paso 2 (Confirmar) con la canasta cargada; el paso 1
     queda accesible para agregar productos.
   - Botón "Modificar venta · {total}" y `PUT` con `originalItemIds`.
   - `useClienteSeleccionado({ loadDefault: !isEdit })`.
   - Al guardar vuelve a `/venta-detalle/{id}`.
3. **Entrada según dispositivo** (mismo patrón del home para nueva venta):
   el botón "Editar" de `venta-detalle` usa `useIsDesktop`:
   desktop → `/venta-form/[id]`; móvil → `/venta/editar-movil/[id]`.
4. Título "Editar venta" en `app-shell` para la nueva ruta + `LoadingState`
   durante la hidratación.

## Alternativas descartadas

- **Responsive de `/venta-form`**: duplica esfuerzo en una UI no pensada
  para táctil cuando el wizard ya existe.
- **Sheet de edición rápida en venta-detalle** (solo cantidades/precios):
  menos trabajo pero no permite agregar productos ni cambiar
  cliente/forma de venta. Posible complemento futuro.

## Esfuerzo y riesgo

Moderado: 1 hook extraído, 1 ruta nueva, ajustes al wizard y un botón
condicionado por dispositivo. Cero backend. Riesgo principal: kardex
(`id`/`originalItemIds` correctos) — neutralizado al reutilizar el hook de
carga extraído en vez de reescribir la hidratación.

## Estado

Implementada (2026-06-12):

- `src/hooks/pos/use-venta-edicion.ts` — hook extraído de
  `use-pos-transaction` (carga + elegibilidad + hidratación +
  `originalItemIds` + flag `redirecting`); ambos flujos lo consumen.
- `use-pos-transaction` refactorizado: sin efecto de carga propio,
  `loading` computado (`isEdit ? edicion.loading : !initialReady`),
  `redirectTo` → `redirecting` (PosShell actualizado).
- `VentaMovilWizard` con prop `idVenta`: arranca en paso Confirmar,
  `loadDefault: !isEdit`, PUT con `originalItemIds`, vuelve a
  `/venta-detalle/{id}`, botón "Modificar venta". Guard para que el
  rebote a paso 1 por canasta vacía no dispare durante la hidratación.
- Ruta `/venta/editar-movil/[id]` + botón "Editar" de venta-detalle
  condicionado por `useIsDesktop` + título en app-shell.

Verificado con lint, tsc y suite e2e (5 pass; falla solo el preexistente
de cart-item-detail-sheet, roto también en main limpio).
