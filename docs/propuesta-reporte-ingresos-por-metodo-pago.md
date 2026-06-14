# Propuesta: Reporte de ingresos por método de pago (móvil)

**Fecha:** 2026-06-13
**Estado:** propuesta / pendiente de aprobación

## Objetivo

Un reporte **mobile-first** que, para un **rango de fechas**, muestre por
**método de pago** (y "NINGUNO" cuando el documento no tiene método):

- **INGRESOS** — dinero recibido = Venta contado + Abonos
- **VENTA** — total de ventas (contado + crédito)
- **VENTA EFECTIVO** — ventas pagadas (no crédito)
- **ABONOS** — pagos a deuda (tipo 2)

## Definiciones (confirmadas)

Sobre los documentos del rango (excluye ajustes tipo 5, ya excluidos por
`getVentas`), agrupados por `MetodoPago.Nombre` (si `IdMetodoPago` es `null` →
grupo **"NINGUNO"**):

| Medida | Cálculo |
|---|---|
| **VENTA** | Σ `Total` de tipo 1 (Venta), crédito **y** contado |
| **VENTA EFECTIVO** | Σ `Total` de tipo 1 con `bCredito = false` |
| **ABONOS** | Σ `Total` de tipo 2 (Abono) |
| **INGRESOS** | VENTA EFECTIVO + ABONOS |

Notas de coherencia:
- Las **ventas a crédito** tienen `IdMetodoPago = null` (el wizard lo fuerza),
  así que caen en **NINGUNO** y suman en VENTA pero **no** en VENTA EFECTIVO ni
  INGRESOS — correcto: aún no entró dinero.
- El **abono con saldo a favor (tipo 6)** y la **captura de saldo a favor
  (tipo 4)** quedan **fuera** (no son dinero recibido por método en este corte).
- Los **gastos (tipo 3)** quedan fuera (el reporte es de ingresos).

## Fuente de datos (confirmada: reusar `/api/ventas`)

`GET /api/ventas?fechaIni=…&fechaFin=…` ya:
- filtra por rango (`FechaEmision`), tenant y sucursal activa,
- excluye ajustes (tipo 5),
- **incluye `MetodoPago(Nombre)`** en el embed.

La agregación se hace **en el cliente** (mismo patrón que la home), sin backend
nuevo. Si a futuro el volumen lo exige, se puede migrar a una RPC
`reporte_ingresos_por_metodo(desde, hasta)` sin cambiar la UI.

```ts
type GrupoMetodo = {
  metodo: string;          // MetodoPago.Nombre ?? "NINGUNO"
  ingresos: number;
  venta: number;
  ventaEfectivo: number;
  abonos: number;
  countVentas: number;
  countAbonos: number;
};
```

Agregación: un solo `reduce` sobre los documentos del rango → `Map<metodo,
GrupoMetodo>`, ordenado por INGRESOS desc, con "NINGUNO" al final. Totales
generales = suma de los grupos.

## Layout móvil

```
┌─────────────────────────────────┐
│ ← Reporte de ingresos           │   PageHeader
├─────────────────────────────────┤
│ [ Día ][ Semana ][ Mes ][ ⚙ ]   │   selector de período (reuso home)
│ 01 jun – 13 jun 2026            │
├─────────────────────────────────┤
│  TOTALES                         │   card resumen (sticky opcional)
│  Ingresos      $ 1.250.000       │
│  Venta         $ 1.800.000       │
│  Venta efect.  $ 1.000.000       │
│  Abonos        $   250.000       │
├─────────────────────────────────┤
│  Efectivo            $ 900.000 ▸ │   1 card por método
│  Ingresos $900.000 · 18 vtas     │
│  ─────────────────────────────   │
│  Venta          $ 900.000        │
│  Venta efectivo $ 800.000        │
│  Abonos         $ 100.000        │
├─────────────────────────────────┤
│  Tarjeta            $ 350.000 ▸ │
│  …                               │
├─────────────────────────────────┤
│  NINGUNO            $ 550.000 ▸ │   crédito sin método
│  Venta          $ 550.000        │
│  Venta efectivo $       0        │
│  Abonos         $   50.000       │
└─────────────────────────────────┘
```

- **Cards apiladas** (1 columna en móvil, `lg:grid-cols-2` en escritorio),
  cada una con el nombre del método, su INGRESOS destacado y el desglose de las
  4 medidas — reutiliza el lenguaje visual de `BalanceCards`/detalle de venta.
- **Card de totales** arriba para lectura rápida.
- **Sin método → "NINGUNO"** siempre visible si hay datos.
- Montos con `numToString` (respeta símbolo/decimales del negocio).
- Estados `LoadingState` (skeleton) y `EmptyState` ("Sin movimientos en el
  rango") ya disponibles.

## Componentes / archivos

- **Ruta:** `src/app/reporte-ingresos/page.tsx` (client component).
- **Selector de período:** reusar el mismo control de la home (`Día/Semana/Mes`
  + rango), leyendo/escribiendo el filtro de fechas del store.
- **Agregación:** helper puro `agruparPorMetodo(docs): { grupos, totales }` en
  `src/lib/reportes.ts` (testeable, sin React).
- **Card:** `src/components/reportes/metodo-pago-card.tsx`.
- **Navegación:** entrada en `nav-menu.tsx` (grupo "gestion", icono `BarChart3`,
  roles `ADMIN`, `SUPERVISOR`, `CAJERO`). Opcional: acceso directo desde la home.
- **Título** en `app-shell.tsx` (`getPageTitle`).

## Fases

1. `agruparPorMetodo` en `lib/reportes.ts` (lógica pura).
2. Página `/reporte-ingresos`: período + fetch `/api/ventas` + render de cards.
3. `MetodoPagoCard` + card de totales.
4. Entrada de navegación + título.
5. (Opcional, futuro) RPC SQL si el volumen lo pide.

## Fuera de alcance (posibles extensiones)

- Exportar a CSV/compartir imagen del reporte.
- Filtro adicional por usuario/cajero.
- Gráfico (barras por método).
- Incluir gastos / flujo neto.

---

## Actualización (implementado, 2026-06-13)

1. **Medida DEUDA por grupo.** Se agregó `deuda` a `GrupoMetodo` = Σ Total de
   ventas (tipo 1) a crédito. Relación exacta: **VENTA = Venta efectivo + Deuda**.
   La card muestra: Venta / Venta efectivo / Deuda (color warning) / Abonos.

2. **"Deuda" como método de pago real (decisión del usuario).** En lugar de
   dejar las ventas a crédito en "NINGUNO", se crea un `MetodoPago` real llamado
   **"Deuda"** por tenant y se asigna a las ventas a crédito:
   - **Migración** `20260613010000_metodo_pago_deuda.sql` (idempotente, pendiente
     de aplicar): crea "Deuda" por tenant + backfill de ventas a crédito sin
     método.
   - **Backend** `documentoService.guardarVentaConItems`: si `bCredito`, resuelve
     el id del método "Deuda" del tenant (cache) y lo asigna (en vez de null).
     Cubre alta y edición (ambas pasan por este service).
   - **Oculto de selectores**: `getMetodoPago` excluye `Nombre = 'Deuda'`, así no
     aparece como forma de pago en POS/gasto/abono/saldo-favor.
   - El reporte agrupa por el nombre del método embebido → las ventas a crédito
     caen en el grupo **"Deuda"** automáticamente. Sin la migración, degradan a
     "NINGUNO" sin romper nada.

3. **Navegación**: entrada "Reporte ingresos" en `nav-menu` (grupo gestión,
   roles ADMIN/CAJERO/SUPERVISOR) + título en `app-shell`. Ruta
   `/reporte-ingresos`.
