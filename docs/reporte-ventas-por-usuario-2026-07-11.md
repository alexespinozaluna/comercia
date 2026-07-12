# Reporte de Ventas por usuario

**Fecha:** 2026-07-11 (actualizado 2026-07-12: card colapsable)
**Estado:** ✅ Implementado (solo frontend + lógica pura; sin API ni migración).
**Objetivo:** ver, por usuario (quien registró el movimiento), sus ventas / abonos / gastos / balance en un rango, con el mismo lenguaje del Reporte de ingresos.

> **Actualización 2026-07-12 — "Por usuario" colapsable (simétrico a "Por tipo").**
> Cada usuario es una **card colapsable**: header `Usuario (count total) · Balance`; al expandir, el desglose por TipoDocumento. Decisiones: opción **A**, headline **Balance**, count **total de documentos**. `GrupoUsuario` pasó a `{ idUsuario, usuario, count, balance, tipos[] }`. Saldo a favor aparece en el desglose pero **no** cuenta en el balance. Card colapsable **genérica** `src/components/reportes/collapsible-report-card.tsx`, compartida con "Por tipo" (se retiraron `tipo-doc-card.tsx`/`usuario-card.tsx`). Toggle **"Por tipo" | "Por usuario"** (ver `docs/reporte-por-tipo-2026-07-12.md`).
>
> **Actualización 2026-07-12 (b) — doble desglose usuario → tipo → método.**
> Cada fila de **tipo** dentro del usuario es ahora también **expandible** a su desglose por método de pago. Estructura: `usuario (colapsable) → tipo (colapsable) → método (hoja)`. `GrupoUsuario.tipos` pasó de plano a **`GrupoTipoDoc[]`** (el mismo tipo de "Por tipo", con `metodos[]` dentro). Se extrajo el helper compartido **`construirTipos(docs): GrupoTipoDoc[]`** usado por `agruparPorTipoDocumento` (global) y por cada usuario (`construirTipos(docsDelUsuario)`) → cero duplicación. La `CollapsibleReportCard` se generalizó a **filas anidadas recursivas** (`ReportNode` con `children` + sangría por nivel); "Por tipo" queda a profundidad 1 y "Por usuario" a profundidad 2. Todo colapsado por defecto.

## Dónde vive

Es una **vista más** dentro de `/reporte-ingresos`, no una página nueva. Un toggle superior alterna **"Por método" | "Por usuario"**, compartiendo la **misma** carga de datos (`/api/ventas?fechaIni&fechaFin`) y los mismos filtros (`DateFilterBar`). Solo cambia la función de agrupación y las cards.

## Cómo funciona

- Cada `Documento` de `/api/ventas` ya trae `IdUsuarioCreacion` y `UsuarioCreacion.Nombre` (embed) → **sin cambios de API ni de tipos**.
- Nueva función pura `agruparIngresosPorUsuario(docs)` en `src/lib/reportes.ts`, hermana de `agruparIngresosPorMetodo`: misma clasificación por **flags** de `tipo-documento` (no por texto), agrupando por `IdUsuarioCreacion`.
- Por usuario: `countVentas`, `ventas`, `efectivo`, `abonos`, `gastos`, `balance` (= efectivo + abonos − gastos). `totales` reutiliza `TotalesIngresos`.

## Decisiones aplicadas (valores recomendados)

1. **Ubicación:** toggle dentro de `/reporte-ingresos` (no página nueva).
2. **Card Gastos:** se muestra en **ambas vistas** (actualizado 2026-07-12 a pedido del usuario). `TotalesIngresosCards` acepta `showGastos` y la página lo pasa siempre → 5 cards (Balance/Ventas/Efectivo/Abono/Gastos). No estaba oculta por falta de datos: antes simplemente no se renderizaba en "por método".
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

## Responsive escritorio (2026-07-12)

Antes la página estaba limitada a `max-w-lg` (columna angosta también en escritorio). Ahora:
- Contenedor `max-w-lg lg:max-w-5xl` (usa el ancho disponible en desktop, mantiene la lectura móvil).
- Totales: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` (una fila de 5 en escritorio).
- Cards de grupo (método/usuario): `sm:grid-cols-2 xl:grid-cols-3`.
- Toggle acotado con `sm:max-w-xs` para no estirarse en pantallas anchas.
