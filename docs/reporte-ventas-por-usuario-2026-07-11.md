# Reporte de Ventas por usuario

**Fecha:** 2026-07-11
**Estado:** ✅ Implementado (solo frontend + lógica pura; sin API ni migración).
**Objetivo:** ver, por usuario (quien registró el movimiento), sus ventas / abonos / gastos / balance en un rango, con el mismo lenguaje del Reporte de ingresos.

## Dónde vive

Es una **vista más** dentro de `/reporte-ingresos`, no una página nueva. Un toggle superior alterna **"Por método" | "Por usuario"**, compartiendo la **misma** carga de datos (`/api/ventas?fechaIni&fechaFin`) y los mismos filtros (`DateFilterBar`). Solo cambia la función de agrupación y las cards.

## Cómo funciona

- Cada `Documento` de `/api/ventas` ya trae `IdUsuarioCreacion` y `UsuarioCreacion.Nombre` (embed) → **sin cambios de API ni de tipos**.
- Nueva función pura `agruparIngresosPorUsuario(docs)` en `src/lib/reportes.ts`, hermana de `agruparIngresosPorMetodo`: misma clasificación por **flags** de `tipo-documento` (no por texto), agrupando por `IdUsuarioCreacion`.
- Por usuario: `countVentas`, `ventas`, `efectivo`, `abonos`, `gastos`, `balance` (= efectivo + abonos − gastos). `totales` reutiliza `TotalesIngresos`.

## Decisiones aplicadas (valores recomendados)

1. **Ubicación:** toggle dentro de `/reporte-ingresos` (no página nueva).
2. **Card Gastos:** variante — `TotalesIngresosCards` acepta `showGastos`; solo la vista "por usuario" la muestra (la vista "por método" queda igual, 4 cards).
3. **Etiqueta:** "Por usuario" (el dato es el creador del documento).
4. **Saldo a favor (tipo 4):** **EXCLUIDO** en ambas vistas (por método y por usuario) — no es venta ni ingreso del reporte; ya no cuenta como `efectivo`/balance. (Actualizado 2026-07-11 tras el criterio "saldo a favor no es parte de la venta").
5. **Orden:** por `balance` desc; "Sin usuario" siempre al final.

## Piezas

| Archivo | Cambio |
|---|---|
| `src/lib/reportes.ts` | +`gastos` en `TotalesIngresos`; **nueva** `agruparIngresosPorUsuario` + `GrupoUsuario` + `SIN_USUARIO` |
| `src/lib/reportes.test.ts` | Tests de la función nueva + del `gastos` en totales (Vitest) |
| `src/components/reportes/totales-ingresos.tsx` | Prop `showGastos` → card Gastos opcional; grid 5 col |
| `src/components/reportes/usuario-card.tsx` | **Nueva** card por usuario |
| `src/app/reporte-ingresos/page.tsx` | Toggle de vista; elige agrupación/cards según `vista` |

Sin migraciones, sin cambios de API, sin RPCs.
