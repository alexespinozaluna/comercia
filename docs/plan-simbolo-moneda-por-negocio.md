# Plan: Símbolo de moneda por Negocio

**Fecha:** 2026-06-11
**Base:** [plan-decimales-por-negocio.md](plan-decimales-por-negocio.md), [plan-locale-por-negocio.md](plan-locale-por-negocio.md)
**Estado:** propuesto, pendiente de validación
**Alcance:** que el símbolo que antecede los montos (`$`, `S/`, `US$`, …) deje de ser el literal `"$ "` hardcodeado en `numToString` y sea configurable por Negocio. Diseño puente acordado con el usuario: a futuro habrá una **tabla `Moneda`** (ventas en moneda nacional o USD por documento); este campo NO la reemplaza — es el símbolo de presentación del negocio.

---

## Diseño

- Columna `SimboloMoneda varchar(8) NOT NULL DEFAULT ''` en `Negocio`.
- **Vacío (default)** → el símbolo se deriva del `Locale` del negocio (moneda nacional): mapa `SIMBOLO_POR_LOCALE` en `src/types/locale.ts`:

  | Locale | Símbolo |
  |---|---|
  | es-CL | `$` |
  | es-PE | `S/` |
  | es-AR | `$` |
  | es-BO | `Bs` |
  | es-CO | `$` |
  | es-MX | `$` |

- **Con valor** → se usa tal cual (texto libre, máx. 8 caracteres; el usuario lo edita en `/configuracion` solo si lo requiere, p. ej. `US$`).
- Compatibilidad futura: la tabla `Moneda` manejará moneda por documento/venta; `SimboloMoneda` quedará como símbolo por defecto de la moneda nacional del negocio.

## Fases

1. **BD**: migración `20260611030000_negocio_simbolo_moneda.sql` (idempotente, default `''`; la numeración salta 020000, ya usada por el workstream de RPCs transaccionales). `Negocio.SimboloMoneda: string` en types. `PUT /api/negocio` lo acepta (trim, máx. 8 chars; vacío permitido).
2. **Formato**: en `format.ts`, estado `currentSimbolo` (mismo patrón: localStorage `app-simbolo`, setter, fallback). `numToString` usa `simbolo` efectivo: `SimboloMoneda` del negocio si no está vacío, si no `SIMBOLO_POR_LOCALE[locale] ?? "$"`. La resolución vacío→locale se hace al **aplicar** la config (un solo lugar: store `setFormato`), no en cada formateo. `FormatoNegocio` (server) gana `simbolo?`.
3. **Aplicación**: `setFormato(locale, decimales, simbolo)` en el store; `negocio-selector` y `/configuracion` pasan el efectivo; `app-shell` agrega `simbolo` a la key de remount; link público resuelve el símbolo del negocio dueño y lo pasa en `fmt`.
4. **UI**: input de texto "Símbolo de moneda (opcional)" en `/configuracion` con placeholder del símbolo derivado del país seleccionado (`placeholder={SIMBOLO_POR_LOCALE[locale]}`), dejando claro que vacío = moneda nacional.
5. Guardado con `useGuardar` (regla nueva de CLAUDE.md para botones de guardar; la página de configuración ya fue migrada a ese hook por el otro workstream — respetar).

## Verificación

`tsc` + lint + build. Manual: con `SimboloMoneda` vacío y Locale es-PE → montos `S/ 1,234.56`; con `US$` → `US$ 1,234.56`; es-CL vacío → `$ 1.234` (sin cambio visual respecto a hoy); link público con el símbolo del negocio dueño.

## Pendientes / próximas decisiones

1. **Tabla `Moneda`** (multi-moneda por venta: nacional o USD, tipo de cambio, total convertido): ciclo futuro mayor; este campo es el puente.
2. El ticket (RPC `generate_ticket_text`) sigue formateando en SQL sin símbolo/locale del negocio — pendiente previo, sin cambios aquí.
3. Espaciado: hoy es `"$ 37.500"` (símbolo + espacio). Se mantiene `{simbolo} {monto}` para todos.
