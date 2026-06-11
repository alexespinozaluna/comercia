# Plan: Decimales de montos por Negocio

**Fecha:** 2026-06-10
**Base:** [plan-locale-por-negocio.md](plan-locale-por-negocio.md)
**Estado:** propuesto, pendiente de validación
**Alcance:** que la cantidad de decimales de los montos (`$ 37.500` vs `$ 37.500,00`) sea configuración del Negocio en BD, igual que el `Locale`. Chile opera sin centavos (0 decimales); Perú y otros usan 2.

---

## Contexto técnico (verificado)

- `numToString`/`formatNumero` tienen 81 llamadas; 77 usan el default `"N0"` implícito, **4 fuerzan `"N2"`** (subtotales del carrito POS: `CartBottomBar`, `CartItemDetailSheet`, `CartItemEditSheet`, `loss-section`) y 3 `"N0"` explícitos son del link público (introducidos en el ciclo de locale).
- El patrón de infraestructura ya existe (ciclo locale): estado de módulo en `format.ts` + cache en localStorage + acción en el store + aplicación desde `negocio-selector` + remount en `app-shell` + paso explícito en server components.

## Fase 1 — BD y API

1. Migración `20260611010000_negocio_decimales.sql` (idempotente):
   ```sql
   ALTER TABLE "Negocio" ADD COLUMN IF NOT EXISTS "Decimales" smallint NOT NULL DEFAULT 0;
   ```
   Valores soportados: `0` (enteros, estilo CLP) y `2` (centavos, estilo PEN). Default 0 = comportamiento actual.
2. `Negocio.Decimales: number` en types; `PUT /api/negocio` valida `0 | 2`.

## Fase 2 — Formato

1. `format.ts`: estado `currentDecimales` (junto a `currentLocale`, cache en localStorage `app-decimales`). Cambio de semántica: si **no** se pasa `format`, los decimales salen de la configuración del negocio (`currentDecimales`); `"N0"`/`"N2"` explícitos siguen forzando.
2. El tercer parámetro de `formatNumero`/`numToString` pasa de `locale?: string` a `fmt?: { locale?: string; decimales?: number }` para que el server component del link público pase ambos (solo 7 call sites lo usan, todos del ciclo anterior).
3. Los 4 `"N2"` forzados del carrito POS **se quitan** → siguen la configuración del negocio. Hoy son inconsistentes: un negocio chileno ve `$ 37.500` en toda la app pero `$ 37.500,00` en el carrito.
4. Store: la acción `setLocale` se reemplaza por `setFormato(locale, decimales)`; `app-shell` re-monta con `key={locale + "-" + decimales}`; `negocio-selector` y `/configuracion` aplican ambos.

## Fase 3 — UI

`/configuracion`: select "Decimales en los montos" con dos opciones:
- `0` → "Sin decimales — $ 37.500"
- `2` → "Con decimales — $ 37.500,00"

## Verificación

`tsc` + lint + build; manual: negocio con `Decimales=2` → todos los montos (home, carrito, deudas, link público) muestran centavos; con `0` → enteros en todos lados incluido el carrito.

## Pendientes / próximas decisiones

1. ¿Confirmar que el carrito POS deja de forzar 2 decimales y sigue al negocio? (propuesto: sí).
2. `formatN2` (inputs editables de precio) se mantiene con 2 decimales fijos — el input permite digitar centavos aunque el negocio muestre enteros. Revisar si molesta en la práctica.
3. Cuando exista la columna `Moneda` (ciclo futuro), evaluar derivar los decimales de la moneda (CLP=0, PEN=2) en vez de columna aparte — por ahora columna explícita, más simple y sin acoplar decisiones.
