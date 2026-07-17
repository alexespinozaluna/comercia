# Auditoría: cards del Dashboard (Balance / Ventas / Efectivo / Pendiente / Abono / Gastos)

**Fecha:** 2026-07-16
**Archivos:** `src/app/page.tsx` (cálculos), `src/components/ventas/balance-cards.tsx` (UI)

## 1. Qué muestra cada card hoy (según el código)

| Card | Fórmula real | Fuente |
|---|---|---|
| **Balance** | `Efectivo + Abono − Gastos` | `page.tsx:113` |
| **Ventas** | Σ `Total` de tipo 1 (incluye ventas a crédito) + contador | `page.tsx:115-117` |
| **Efectivo** | Σ `Total` de ventas **pagadas** (tipo 1, `!bCredito`) **+ capturas de saldo a favor (tipo 4)** — con **cualquier** método de pago | `page.tsx:105-107` |
| **Pendiente** | Σ `Saldo` de ventas a crédito **del periodo** | `page.tsx:114` |
| **Abono** | Σ `Total` de tipo 2 | `page.tsx:109-111` |
| **Gastos** | Σ `Total` de tipo 3 | `page.tsx:112` |

Notas de alcance:
- Tipo 5 (Ajuste/Baja) nunca llega al dashboard (excluido en `getVentas`).
- Tipo 6 (abono con saldo a favor) se ve en la lista pero no suma en ningún card (correcto: es transferencia interna).
- La búsqueda y los filtros (método/usuario/cliente) refinan la lista **y** los totales de los cards (cambiado 2026-07-16; antes los filtros del FilterSheet solo afectaban la lista).

## 2. Problemas detectados

### P1 — "Efectivo" es un nombre engañoso (el problema central)
- **No** filtra por método de pago: incluye transferencia, tarjeta, Yape, etc. El usuario final lee "Efectivo" y espera *billetes en caja* — concepto que ya existe como MetodoPago "Efectivo" en el POS y en `/reporte-ingresos`. Colisión directa de vocabulario.
- Además mezcla dos cosas: ventas cobradas (tipo 1) **+** capturas de saldo a favor (tipo 4). El tipo 4 no es una venta; queda "escondido" ahí sin que ningún card lo nombre.
- Y excluye los abonos (tipo 2), que también son dinero que entró.

### P2 — El Balance no es reconstruible a simple vista
`Balance = Efectivo + Abono − Gastos`, pero con el nombre "Efectivo" el usuario no puede verificar mentalmente la cuenta. La ecuación existe en el código, no en la pantalla.

### P3 — Ventas (facturado) vs Balance (cobrado − gastos)
"Ventas" incluye el crédito (facturado); "Balance" lo excluye. Que `Ventas > Balance` sin haber gastos confunde si no se explicita que la diferencia es lo fiado (Pendiente).

### P4 — Redundancia parcial
Con Balance, Abono y Gastos visibles, "Efectivo" es derivable (`Balance − Abono + Gastos`). Un card que es a la vez redundante *y* mal nombrado es candidato a renombrar o quitar.

## 3. Opciones evaluadas

### Opción A — Renombrar "Efectivo" → "Ingresos" (recomendada)
`Ingresos = ventas cobradas + abonos + capturas de saldo a favor` (todo el dinero que entró, cualquier método).

- ✅ `Balance = Ingresos − Gastos` queda **visible y verificable** en pantalla.
- ✅ Coincide exactamente con el contador del tab "Ingresos (X)" que ya está abajo — mismo número, mismo nombre, cero ambigüedad.
- ✅ "Abono" pasa a leerse como desglose de Ingresos.
- ✅ Se mantienen 6 cards → grid 3×2 móvil intacto.
- ✅ El tipo 4 queda cubierto dentro de Ingresos (donde pertenece: dinero que entró).
- Reordenar para contar la historia: fila 1 = **Balance, Ingresos, Gastos** (la cuenta del día); fila 2 = **Ventas, Pendiente, Abono** (el detalle).

### Opción B — Quitar el card "Efectivo" (5 cards)
- ✅ Elimina la ambigüedad de raíz.
- ❌ Se pierde el total cobrado (habría que abrir /reporte-ingresos).
- ❌ Grid 3×2 queda cojo (5 de 6 celdas).
- ❌ Balance deja de ser verificable (falta un sumando en pantalla).

### Opción C — Renombrar a "Cobrado" (solo ventas pagadas, sin tipo 4 ni abonos)
- ✅ Cierra la ecuación de ventas: `Ventas = Cobrado + fiado`.
- ❌ El tipo 4 queda sin card y el Balance sigue sin ser suma visible.
- ❌ Introduce un tercer concepto ("Cobrado") en lugar de reutilizar "Ingresos" que ya existe en el tab y en /reporte-ingresos.

## 4. Recomendación

**Opción A.** Un solo cambio de semántica (Efectivo → Ingresos = efectivo + abono) alinea dashboard, tabs y reporte de ingresos bajo el mismo vocabulario, hace el Balance auditable a ojo y no rompe el layout. El desglose por método de pago real (efectivo/tarjeta/transferencia) ya vive en `/reporte-ingresos` y no debe duplicarse en cards.

Cambios si se aprueba:
1. `page.tsx`: `totalIngresos = totalEfectivo + totalAbono`; pasar `ingresos` en vez de `efectivo` a `BalanceCards`.
2. `balance-cards.tsx`: card "Efectivo" → "Ingresos" (icono `DollarSign` → `TrendingUp` o similar); reordenar: Balance, Ingresos, Gastos / Ventas, Pendiente, Abono.
3. Sin cambios de API ni BD.
