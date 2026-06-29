# Descuento global en la venta

> Estado: **diseño cerrado → en implementación** (2026-06-29).
> Permite aplicar un **descuento global** sobre el total de una venta (tipo 1),
> mostrándolo explícito en POS, ticket y detalle.

## 1. Decisión de modelo

El descuento vive en la **cabecera** del `Documento`, no en las líneas. Las líneas
(`DocumentoItem`) conservan su `PrecioVenta`/`Total` completos.

| Columna `Documento` | Significado | Sin descuento |
|---------------------|-------------|----------------|
| **`Importe`** (nueva) | Bruto = `Σ(item.Total)`. Siempre poblado. | `== Total` |
| **`Descuento`** (nueva) | Monto del descuento, ya resuelto y redondeado a `Negocio.Decimales`. | `0` |
| **`Total`** (existente) | **Neto** = `Importe − Descuento`. Es lo que ya leen `Saldo`, arqueo, reportes, deuda y abonos. | `== Importe` |

Clave: **no se toca la semántica de `Total`** (sigue siendo el neto / lo que paga el
cliente), así que nada del flujo existente se rompe:

- `Saldo = bCredito ? Total : 0` → la deuda queda con el neto, sin cambios.
- Stock/kardex usa `Cantidad` (no `Total`) → el descuento **no afecta el stock**.
- Arqueo de caja y `/api/reporte-ingresos` suman `Total` (neto) → el descuento baja
  el ingreso, que es lo correcto.
- La auditoría usa `to_jsonb(d.*)` → las columnas nuevas entran solas.

### Por qué guardar el bruto como columna (y no derivarlo)

El ticket, el detalle y futuros reportes muestran el bruto sin tener que sumar los
items en cada lectura. `Importe` es un campo genérico presente en todo documento
(cuando `Descuento = 0`, `Importe == Total`).

## 2. Reglas de negocio

- `0 ≤ Descuento ≤ Importe` (el descuento no puede superar el bruto; `Total ≥ 0`).
- Entrada en UI por **porcentaje o monto fijo** (toggle `% | $`); se **guarda
  siempre el monto** ya resuelto y redondeado a `Negocio.Decimales` (evita pelear
  con la tolerancia `0.01` del RPC).
- **Sin restricción por rol**: cualquier usuario con `VENTAS_Y_CATALOGO` puede
  descontar. `SUPERVISOR` sigue siendo solo-lectura.
- Aplica solo a **ventas (tipo 1)**. Abonos/gastos/ajustes/saldo a favor no usan
  descuento (`Descuento = 0`, `Importe = Total`).

## 3. Validación en el RPC

`guardar_venta_con_items` calcula el bruto desde los items (fuente de verdad) y valida:

```
v_importe   := Σ(item.Total)            -- (crear) o Σ(add)+Σ(update) (modificar)
v_descuento := COALESCE(Descuento, 0)
ASSERT ABS(v_importe - v_descuento - Total) <= 0.01
```

Persiste `Importe = v_importe`, `Descuento = v_descuento`, `Total` (validado).
`Saldo` sigue derivándose de `Total`.

## 4. UI

- Componente **`DescuentoSection`** (desplegable, header-botón + `useState`, estilo
  `NotasSection`, sin Radix/Base UI). Plegado por defecto; si la venta ya trae
  descuento (edición), arranca desplegado. Al abrir muestra:
  - toggle `% | $`,
  - input del valor,
  - desglose **Subtotal / Descuento / Total**.
- **Reutilizado** en:
  - Desktop: `CartSummary` (sidebar/sheet del POS).
  - Móvil: `PasoConfirmar` (paso 2 del wizard).
- Las barras inferiores (`CartBottomBar`, `StickyTotalBar`, botón de `PasoCrear`)
  muestran el **Total neto**. `PasoCrear` añade la línea de descuento en su resumen
  cuando `Descuento > 0`.
- **Ticket** (`src/lib/ticket.ts`) y **detalle** (`venta-detalle/[id]`): muestran
  `Importe` y `Descuento` antes del `TOTAL` **solo cuando `Descuento > 0`**; si es 0
  se ven igual que hoy.

## 5. Cambios por capa

1. **DB** — migración `20260629000000_documento_descuento.sql`: `ADD COLUMN Importe,
   Descuento` + backfill `Importe = Total`; redefine `guardar_venta_con_items`.
2. **Tipos** — `Documento`: `Importe: number`, `Descuento: number`.
3. **Service** — `buildDocumentoJson` incluye `Importe`/`Descuento`.
4. **API** — `POST /api/ventas` y `PUT /api/ventas/[id]`: leen, validan
   (`0 ≤ Descuento ≤ Importe`) y pasan los campos.
5. **Hook** — `useDescuento(subtotal)`: modo `%|$`, monto resuelto y `total` neto.
6. **POS** — `use-pos-transaction` y `VentaMovilWizard`: estado descuento,
   `Importe = basket.total`, `Total = Importe − descuento`; payload con los 3 campos.
7. **UI** — `DescuentoSection` en `CartSummary` y `PasoConfirmar`; `PasoCrear` muestra
   la línea de descuento.
8. **Edición** — `useVentaEdicion`: hidrata `Descuento` al cargar la venta.
9. **Ticket + detalle** — render del desglose.

## 6. Verificación

- Crear venta pagada con descuento (% y monto): `Importe`, `Descuento`, `Total`,
  `Saldo=0` correctos; arqueo de caja suma el neto.
- Crear venta a crédito con descuento: `Saldo = Total` neto; abono posterior cuadra.
- Editar venta con/sin descuento: el diff de items no se rompe (kardex intacto).
- Ticket y detalle muestran el desglose solo si hay descuento.
- `/api/reporte-ingresos` refleja el neto.
