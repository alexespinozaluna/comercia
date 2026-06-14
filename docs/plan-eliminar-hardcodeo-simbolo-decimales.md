# Plan: eliminar hardcodeo de símbolo de moneda y decimales (respetar `Negocio`)

**Fecha:** 2026-06-13
**Estado:** propuesta / pendiente de ejecución

## Objetivo

Que **ningún** punto de la app muestre un símbolo de moneda o un número de
decimales fijo. Todo monto —al **mostrarse** y al **editarse**— debe respetar la
configuración del negocio activo:

- `Negocio.SimboloMoneda` (resuelto con `simboloEfectivo()` → símbolo nacional
  del `Locale` cuando está vacío).
- `Negocio.Decimales` (0 = enteros estilo CLP, 2 = centavos).

Hoy la **visualización** ya respeta la config a través de `numToString()` /
`formatNumero()` (`src/lib/format.ts`), pero los **inputs de captura de montos**
y algún render quedaron al margen: usan `$` literal en el prefijo y `formatN2`
(2 decimales fijos). Este plan los alinea y cierra la puerta a reincidencias.

## Contexto técnico (cómo funciona hoy)

- `src/lib/format.ts` mantiene estado de módulo: `currentSimbolo`,
  `currentDecimales`, `currentLocale` (sembrado desde `localStorage`).
- El store `app-store.setFormato(locale, decimales, simbolo)` los actualiza al
  cargar/cambiar de negocio (`negocio-selector.tsx:48`, `configuracion/page.tsx:97`).
- `app-shell.tsx:315` re-monta el árbol con `key={`${locale}-${decimales}-${simbolo}`}`,
  así que **cualquier componente que lea `getSimbolo()`/`getDecimales()` en
  render recoge el valor nuevo tras el remount** — no hace falta cablear un hook
  reactivo nuevo.
- `simboloEfectivo()` (`src/types/locale.ts:62`) ya resuelve vacío→locale; la
  resolución ocurre en `setFormato`, de modo que `currentSimbolo` siempre llega
  resuelto.

> Conclusión de diseño: los inputs pueden leer `getSimbolo()`/`getDecimales()`
> directamente en render (igual que `numToString`), sin nueva tubería.

## Inventario de hardcodeo (auditoría 2026-06-13)

### A. Símbolo `$` literal en prefijo de input (10 ocurrencias)

| Archivo | Línea | Campo |
|---|---|---|
| `src/app/caja/page.tsx` | 263 | Monto final (cierre) |
| `src/app/caja/page.tsx` | 332 | Monto inicial (apertura) |
| `src/app/venta-gasto/page.tsx` | 125 | Valor del gasto |
| `src/app/venta-abono/page.tsx` | 266 | Monto del abono |
| `src/app/saldo-favor/page.tsx` | 269 | Monto a favor (alta) |
| `src/app/saldo-favor/page.tsx` | 333 | Monto a favor (edición) |
| `src/app/producto/datos/[id]/page.tsx` | 125-126 | Precio venta |
| `src/app/producto/datos/[id]/page.tsx` | 159-160 | Precio costo |
| `src/components/ventas/pos/CartItemEditSheet.tsx` | 73-74 | Precio unitario (móvil) |
| `src/components/ventas/pos/CartItemDetailSheet.tsx` | 128-129 | Precio unitario (detalle) |

Todas comparten el mismo `<span>` copiado:
`className="absolute left-3 ... pointer-events-none">$</span>` + `pl-7` en el input.

### B. Decimales fijos en inputs editables (`formatN2` = siempre 2)

| Archivo | Línea | Detalle |
|---|---|---|
| `src/lib/format.ts` | 158-163 | `formatN2()` fuerza `min/maxFractionDigits: 2` |
| `src/components/ventas/pos/CartItemEditSheet.tsx` | 39 | init del input con `formatN2` |
| `src/components/ventas/pos/CartItemDetailSheet.tsx` | 49 | init del input con `formatN2` |

Efecto en un negocio chileno (`Decimales=0`): la lista y el subtotal muestran
`$ 1.500` (correcto), pero al abrir el editor el input muestra `1.500,00`.
Era un pendiente explícito de `docs/plan-decimales-por-negocio.md:28`
("quitar los `N2` forzados del carrito POS").

> Nota: los inputs `type="number"` (producto, gasto, abono, saldo-favor, caja)
> no fuerzan decimales (usan valor crudo + `parseFloat`), pero **sí** tienen el
> `$` hardcodeado y carecen de formato de miles/decimales del locale.

### C. Render server-side / ticket

| Archivo | Estado |
|---|---|
| `src/lib/ticket.ts` (canvas PNG) | Usa `numToString`/`cantidadString` → lee estado global. Funciona para el negocio activo, pero **frágil**: debería recibir `fmt` del `negocio` recibido por parámetro. |
| `generate_ticket_text` (RPC plpgsql, vía `documento-service.getTicketText`) | **A verificar**: el texto del ticket térmico se arma en la BD; revisar si formatea `$`/decimales fijos. |

## Diseño de la solución

### Pieza 1 — Helper de formato de input que respeta `Decimales`

En `src/lib/format.ts`, reemplazar el uso de `formatN2` para montos por un
formateador consciente de la config:

```ts
/** Monto para input editable, según los decimales del negocio.
 * 0 → "1.500", 2 → "1.500,00". Sin símbolo (el prefijo lo pone el input). */
export function formatMontoInput(value: number | null | undefined): string {
  return formatNumero(value); // ya respeta currentDecimales + currentLocale
}
```

`parseFormatted()` ya es locale-aware y sirve para 0 y 2 decimales sin cambios.
`formatN2` queda **deprecado** (no lo usa nadie más tras la migración) — eliminarlo.

### Pieza 2 — Componente `MontoInput` compartido (única fuente del símbolo)

Crear `src/components/shared/monto-input.tsx`: un input de monto reutilizable que
encapsula el prefijo de símbolo y el formato/parseo, eliminando las 10 copias.

API basada en número (lo que ya manejan los padres):

```tsx
interface MontoInputProps {
  value: number;
  onChange: (n: number) => void;
  autoFocus?: boolean;
  className?: string;
  ariaLabel?: string;
}
```

Responsabilidades internas:
- Prefijo = `getSimbolo()` (no `$`). Padding-left dinámico según ancho del
  símbolo (`$` vs `S/` vs `Bs`), no `pl-7` fijo.
- Estado local de string (patrón ya usado en los sheets): init/blur con
  `formatMontoInput(value)`, `onChange` parsea con `parseFormatted` y emite número.
- `inputMode="decimal"`, `type="text"`, `onFocus → select()`.

Esto unifica además los inputs que hoy son `type="number"` crudos, dándoles
formato de miles/decimales coherente con el resto de la app (mejora secundaria).

### Pieza 3 — (opcional) Guard anti-reincidencia

Regla ESLint `no-restricted-syntax` que prohíba el `<span>…>$</span>` literal en
prefijos, o un check de CI con `grep` que falle si aparece `pointer-events-none">$`.
Documentar la regla "montos → `MontoInput` / `numToString`, nunca `$` literal" en
`CLAUDE.md`.

## Plan de ejecución por fases

### Fase 1 — `format.ts`
1. Añadir `formatMontoInput()`.
2. Marcar `formatN2` como deprecado (se elimina al final de Fase 3).

### Fase 2 — Componente `MontoInput`
3. Crear `src/components/shared/monto-input.tsx` (Pieza 2).
4. (Opcional) Snapshot/test manual con dev-harness (patrón E2E ya existente).

### Fase 3 — Migrar los 10 sitios
Reemplazar cada bloque `<div className="relative"><span>$</span><Input .../></div>`
por `<MontoInput value={...} onChange={...} />`:
5. `CartItemEditSheet.tsx` (móvil) — quita `formatN2`/`$`.
6. `CartItemDetailSheet.tsx` — quita `formatN2`/`$`.
7. `caja/page.tsx` (×2: inicial y final).
8. `venta-gasto/page.tsx`.
9. `venta-abono/page.tsx`.
10. `saldo-favor/page.tsx` (×2).
11. `producto/datos/[id]/page.tsx` (×2: venta y costo).
12. Eliminar `formatN2` de `format.ts` y sus imports.

### Fase 4 — Ticket
13. `src/lib/ticket.ts`: pasar `fmt` derivado del `negocio` recibido a
    `numToString`/`cantidadString` (robustez aunque hoy el global coincida).
14. Revisar la RPC `generate_ticket_text` (BD): si formatea `$`/decimales fijos,
    parametrizar con `SimboloMoneda`/`Decimales`/`Locale` del negocio
    (migración SQL nueva, idempotente, siguiendo convención de numeración).

### Fase 5 — Guard
15. (Opcional) Regla ESLint + nota en `CLAUDE.md`.

## Verificación

- **es-CL (`Decimales=0`, símbolo vacío→`$`)**: inputs y displays muestran `$ 1.500`
  sin `,00`; editar precio en el carrito ya no agrega decimales.
- **es-PE (`Decimales=2`, símbolo vacío→`S/`)**: todo muestra `S/` y `1,500.00`,
  incluido el prefijo de los inputs (antes `$`).
- **Símbolo propio** (ej. `US$` en `SimboloMoneda`): prefijo de inputs y displays
  usan `US$`.
- `npm run lint` y `npm run build` limpios.
- Smoke manual: caja apertura/cierre, gasto, abono, saldo a favor (alta/edición),
  producto (venta/costo), carrito móvil (editar precio), ticket PNG y térmico.

## Riesgos / notas

- `MontoInput` con `type="text"` cambia el teclado móvil de numérico puro a
  `inputMode="decimal"` (incluye separador) — es lo deseado para montos con
  decimales; en `Decimales=0` el usuario igual puede teclear enteros.
- Los `type="number"` actuales aceptan notación científica/`-`; al pasar a texto
  formateado se normaliza con `parseFormatted` (más estricto, mejor UX).
- La Fase 4 (RPC ticket) puede requerir migración SQL — separable en su propio
  workstream si la RPC ya parametriza moneda.

## Archivos afectados (resumen)

- `src/lib/format.ts` (helper nuevo, baja de `formatN2`)
- `src/components/shared/monto-input.tsx` (nuevo)
- `src/components/ventas/pos/CartItemEditSheet.tsx`
- `src/components/ventas/pos/CartItemDetailSheet.tsx`
- `src/app/caja/page.tsx`
- `src/app/venta-gasto/page.tsx`
- `src/app/venta-abono/page.tsx`
- `src/app/saldo-favor/page.tsx`
- `src/app/producto/datos/[id]/page.tsx`
- `src/lib/ticket.ts`
- `generate_ticket_text` (migración SQL, a confirmar)
- `CLAUDE.md` + ESLint (opcional, anti-reincidencia)
