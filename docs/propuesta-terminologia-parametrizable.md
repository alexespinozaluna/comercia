# Propuesta: terminología de forma de venta parametrizable (2026-06-12)

## Problema

El renombre Contado/Crédito → Pagado/Deuda
(ver [cambio-terminologia-pagado-deuda-2026-06-12.md](cambio-terminologia-pagado-deuda-2026-06-12.md))
obligó a tocar ~9 archivos porque las etiquetas estaban hardcodeadas en cada
punto de uso: toggle, badge de lista, badge de detalle (`FormaVenta`), ticket,
y 3 mensajes de validación.

## Propuesta en dos fases

### Fase 1 — Módulo central `src/lib/terminologia.ts` (recomendada ya)

Diccionario único + helpers, sin DB ni async:

```ts
const DEFAULTS = {
  ventaPagada: "Pagado",
  ventaDeuda: "Deuda",
} as const;

export function t(key: keyof Terminos): string;
/** "Pagado" / "Deuda" según bCredito. */
export function labelFormaVenta(bCredito: boolean): string;
```

Puntos de uso que migran a consumir el módulo:

| Lugar | Hoy | Pasa a |
|---|---|---|
| `FormaVentaToggle.tsx` | `label: "Pagado"/"Deuda"` | `t("ventaPagada")` / `t("ventaDeuda")` |
| `venta-list-item.tsx` (badge) | ternario hardcodeado | `labelFormaVenta(v.bCredito)` |
| `types/database.ts` (`FormaVenta`) | `"DEUDA" : "PAGADO"` | `labelFormaVenta(...).toUpperCase()` |
| `lib/ticket.ts` | `"DEUDA" : "PAGADO"` | `labelFormaVenta(...).toUpperCase()` |
| Toasts/aviso (wizard, `use-pos-transaction`, `ClientSelector`) | frase fija | frase generada con `t("ventaDeuda")` |

Resultado: el próximo renombre es 1 línea en 1 archivo.

### Fase 2 — Override por negocio (opcional, cuando se pida)

Replica el patrón ya probado de `Locale`/`Decimales`/`SimboloMoneda` en
`lib/format.ts` + `app-store.setFormato`:

1. Columna `Negocio.Terminologia jsonb NULL` con overrides parciales,
   p. ej. `{"ventaDeuda": "Fiado"}`. Lo ausente cae a `DEFAULTS`.
2. `setTerminologia(overrides)` en el módulo: merge sobre defaults +
   persistencia en localStorage (evitar parpadeo del primer render,
   igual que `Decimales`).
3. Hidratar en el mismo punto donde hoy se llama `setFormato` al cargar
   el `Negocio` (un parámetro más, sin tubería nueva).
4. UI en `/configuracion`: dos inputs para las dos etiquetas.

Mensajes compuestos se generan desde el término
(`` `Las ventas con ${t("ventaDeuda").toLowerCase()} requieren un cliente` ``),
no se piden redactados al usuario.

## Descartado

- **Librería i18n (next-intl, etc.)**: la app es monolenguaje; el problema es
  vocabulario por negocio, no traducción. El patrón de `format.ts` lo resuelve
  en ~40 líneas sin providers ni archivos de mensajes.

## Cuidados

- `/p/deuda/[token]` (página pública) y cualquier render server-side no pasan
  por el app-store del cliente: en Fase 2 esa página debe leer
  `Negocio.Terminologia` en su propio fetch. En Fase 1 no aplica (defaults
  estáticos).
- `FormaVenta` y el ticket usan mayúsculas: derivar con `.toUpperCase()`,
  no duplicar constantes en mayúscula.

## Estado

- Fase 1: **implementada (2026-06-12)** — `src/lib/terminologia.ts` con
  `t()`, `labelFormaVenta()` y los mensajes de validación
  (`msgDeudaRequiereCliente`, `msgDeudaRequiereSeleccionarCliente`).
  Los 9 puntos de uso migrados; ya no hay etiquetas hardcodeadas.
- Fase 2: diseñada, implementar solo cuando un negocio pida otra palabra.
