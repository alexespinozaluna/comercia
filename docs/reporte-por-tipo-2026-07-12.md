# Reporte de ingresos — vista "Por tipo" (TipoDocumento → método, expandible)

**Fecha:** 2026-07-12
**Estado:** ✅ Implementado (frontend + lógica pura; sin API ni migración).
**Reemplaza** la vista "Por método" del toggle de `/reporte-ingresos`.

## Formato

Nivel 1 (colapsado): una fila por **TipoDocumento** con conteo y total.
Nivel 2 (al expandir con el chevron): desglose **por método de pago**.

```
Venta (20)   $ 560.250   ⌄
    Transferencia (8)   $ 260.250
    Efectivo     (12)   $ 300.000
Abono (3)    $ 124.500   ⌄
    Efectivo      (3)   $ 124.500
Gasto (3)    $ 450.000   ⌄
    Efectivo      (3)   $ 450.000
Saldo a favor (2)  $ 80.000  ⌄
    ...
```

Formato de cada fila de método: `{Metodo} ({count}) {símbolo} {Σ Total}` (el símbolo lo pone `numToString` según el negocio).

## Decisiones aplicadas

1. **Toggle:** opción A — se **reemplaza** "Por método" por **"Por tipo"**. El toggle es ahora **"Por tipo" | "Por usuario"**; "Por tipo" es la vista por defecto.
2. **Tipos listados:** Venta (1), Abono (2), Gasto (3), **Saldo a favor (4)**. Excluye Ajuste (5, ya filtrado por getVentas) y Abono-con-favor (6, no es ingreso).
3. **Crédito también es venta:** las ventas a crédito aparecen bajo su método **"Deuda"** dentro del grupo Venta (así los métodos suman el total del tipo).
4. **Colapsado por defecto:** todos los grupos inician cerrados; se pueden abrir varios.

## Totales (arriba, sin cambios de criterio)

Se conservan las `TotalesIngresosCards` (Balance/Ventas/Efectivo/Abono/Gastos). **Saldo a favor sigue EXCLUIDO** de efectivo/balance (aunque **sí** aparezca como grupo en la lista): el grupo muestra su total, pero no cuenta como ingreso en las cards.

## Piezas

| Archivo | Cambio |
|---|---|
| `src/lib/reportes.ts` | **Nueva** `agruparPorTipoDocumento` + tipos `GrupoTipoDoc`/`GrupoMetodoDeTipo`. **Eliminadas** `agruparIngresosPorMetodo`/`GrupoMetodo` (reemplazadas). Helpers de totales `acumularTotales`/`finalizarBalance` compartidos por las dos vistas (DRY). |
| `src/lib/reportes.test.ts` | Tests de la nueva agregación (orden de tipos, desglose por método, crédito=Deuda, exclusión de saldo a favor en totales, tipos fuera del reporte). |
| `src/components/reportes/collapsible-report-card.tsx` | Card colapsable **genérica** (header `título (count) · monto` + filas `label (count) monto`), compartida por "Por tipo" y "Por usuario". |
| `src/components/reportes/metodo-pago-card.tsx` | **Eliminada.** |
| `src/app/reporte-ingresos/page.tsx` | Toggle "Por tipo/Por usuario"; render con `CollapsibleReportCard`. |

> Actualización 2026-07-12: la card específica `TipoDocCard` se generalizó a `CollapsibleReportCard` (ver `docs/reporte-ventas-por-usuario-2026-07-11.md`), usada por ambas vistas.

Sin API nueva, sin migración, sin RPC. Todo sobre la misma carga `/api/ventas`.

## Nota de UX

Con este formato, el **total de un método across tipos** (p. ej. todo el Efectivo de ventas + abonos) queda repartido entre grupos (Efectivo bajo Venta + Efectivo bajo Abono). El total global de Efectivo sigue en las cards de totales. Si en el futuro se quiere el total por método consolidado, habría que reintroducir esa vista (sería la opción B: tres pestañas).
