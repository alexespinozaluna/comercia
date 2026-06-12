# Cambio de terminología: Contado/Crédito → Pagado/Deuda (2026-06-12)

## Decisión

Renombrar en toda la UI la terminología de la forma de venta:

| Antes     | Ahora    |
|-----------|----------|
| Contado   | Pagado   |
| Crédito   | Deuda    |

Es un cambio **solo de presentación**. No cambia nada de datos ni lógica:
`bCredito`, el `value: "credito"` interno del toggle, el cálculo de `Saldo`
y los flags de `tipo-documento` quedan intactos.

## Alcance (archivos tocados)

Textos visibles al usuario:

- `src/components/ventas/pos/cart/FormaVentaToggle.tsx` — labels del toggle
  "Forma de venta" (compartido por POS desktop y wizard móvil).
- `src/components/ventas/venta-list-item.tsx` — badge "Deuda"/"Pagado" en la
  lista de movimientos.
- `src/types/database.ts` — `FormaVenta` calculado: `"DEUDA" | "PAGADO"`
  (antes `"CREDITO" | "EFECTIVO"`); se muestra en el badge del detalle de venta.
- `src/lib/ticket.ts` — línea "Forma Venta:" del ticket impreso/compartido.
- `src/app/layout.tsx` — description del metadata PWA.
- Mensajes de validación "Las ventas con deuda requieren un cliente" en
  `VentaMovilWizard.tsx`, `use-pos-transaction.ts` y `ClientSelector.tsx`.

Comentarios de código actualizados a la nueva terminología en:
`use-pos-transaction.ts`, `VentaMovilWizard.tsx`, `CartSummary.tsx`,
`ClientSelector.tsx`, `FormaPagoChips.tsx`, `app/page.tsx`,
`venta-detalle/[id]/page.tsx`, `lib/tipo-documento.ts`.

## Fuera de alcance (otros significados, NO se tocaron)

- "Monto contado" / "Contado" en Caja (`caja/page.tsx`, `caja/historial`) =
  efectivo **contado** físicamente al cierre, no forma de venta.
- "Stock contado" en ajustes de kardex (`registro-baja-form.tsx`, API ajustes).
- "Crédito del cliente" en Saldo a favor (tipos 4 y 6) = anticipo disponible,
  concepto distinto de la venta con deuda.
