# Propuesta: cantidad editable inline en Confirmar pedido (2026-06-12)

## Problema

En el paso 2 del wizard móvil ("Confirmar pedido"), la cantidad de cada
ítem es un botón que abre `CartItemEditSheet` (bottom sheet). Editar una
cantidad escribiéndola cuesta 3 toques + animación: tocar número → sheet →
escribir → "Actualizar". Debería ser edición directa en el input.

## Estado actual

- `CartItemsList` (compartido por `PasoConfirmar` móvil y `CartSummary`
  desktop) renderiza `− [botón número] +`; el botón llama `onEditQuantity`
  que abre el sheet.
- `CartItemEditSheet` edita UN campo por vez (`cantidad` | `precio`),
  separados a propósito para evitar ediciones accidentales.
- `useBasket.setQuantity(tempId, value)` ya existe (clamp ≥ 1):
  no se requieren cambios de estado/hooks/datos.

## Propuesta

### 1. Nuevo `cart/CantidadInput.tsx` (borrador local + commit en blur/Enter)

- `type="text"` + `inputMode="decimal"` (teclado numérico móvil),
  `w-12 h-7` centrado tabular-nums — mismo footprint que el botón actual.
- Borrador en estado local mientras está enfocado: permite vaciar/escribir
  parcial sin que el clamp pelee con el usuario.
- `onFocus` → select all (escribir encima sin borrar).
- Commit en `blur`/`Enter`: parsea aceptando coma o punto; válido →
  `setQuantity` (clamp ≥ 1); vacío/inválido → revierte al valor anterior.
- Sin foco se re-sincroniza desde props (los botones −/+ siguen
  reflejándose en el input).

### 2. `CartItemsList`

Reemplaza el botón de cantidad por `CantidadInput`; elimina la prop
`onEditQuantity`. Botones −/+ se mantienen.

### 3. `CartItemEditSheet` queda solo-precio

Eliminar `CartEditField`, la rama de cantidad y `onSetQuantity`.
`PasoConfirmar` y `CartSummary` reducen su estado a solo `editItem`.

## Decisiones

- **Aplica también al POS desktop** (componente compartido, conducta única).
- **Decimales permitidos** (`setQuantity` no redondea; `cantidadString`
  ya los formatea — ventas por peso).
- **Precio sigue en sheet** (formato moneda, riesgo de edición accidental;
  fuera de alcance).

## Riesgo / impacto

Bajo. 3 archivos modificados + 1 nuevo; cero cambios en hooks/datos/API.
La validación de `irACrear` (cantidad y precio > 0) sigue cubriendo casos
límite. El e2e `cart-item-detail-sheet.spec.ts` cubre otro componente
(dev-harness) y no se rompe; opcional: harness nuevo para `CantidadInput`.

## Estado

Implementada (2026-06-12). `CantidadInput` nuevo; `CartItemsList` con input
inline (prop `onSetQuantity` reemplaza `onEditQuantity`); `CartItemEditSheet`
ahora solo-precio (sin `CartEditField`); `PasoConfirmar` y `CartSummary`
simplificados.

Nota: el e2e `cart-item-detail-sheet.spec.ts` ("subtotal reactivo") falla
también en `main` limpio — preexistente, probablemente por el cambio de
locale por negocio (2026-06-11); no relacionado con este cambio.
