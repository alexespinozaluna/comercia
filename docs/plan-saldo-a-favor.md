# Saldo a favor (anticipo) — módulo propio

Fecha: 2026-06-05 (replanteado 2026-06-06)
Base: análisis del flujo de abonos. **Decisión final: Opción C** — el saldo a
favor es un módulo aparte; `venta-abono` NO se modifica.
Estado: **implementado** (Fase 1).

## Objetivo

Registrar un **saldo a favor / anticipo** de un cliente: un crédito a su favor
que quedará disponible para consumir en deudas/ventas futuras (Fase 2).

## Cambio de enfoque (vs. intento anterior)

El primer intento (Opción A) detectaba el sobrepago **dentro** de `venta-abono`
y modificaba el RPC `registrar_abono`. Se descartó:
- `venta-abono` debe quedarse **tal como está** (solo paga deudas, bloquea
  sobrepago).
- El saldo a favor se ingresa en un **módulo propio** (`/saldo-favor`).
- Si un cliente paga de más: se abona la deuda en `venta-abono` y, por separado,
  se registra el excedente en `/saldo-favor` (dos pasos, módulos limpios).

Se revirtieron los cambios en `venta-abono`, `api/abonos`, `registrarAbono` y se
**eliminó la migración** que tocaba `registrar_abono`.

## Decisiones (validadas con el usuario)

1. **Modelo**: documento `IdTipoDocumento = 4` (reusa `Documento`).
2. **Módulo**: anticipo puro (cliente + monto → crédito; no toca deudas), en
   **página propia** `/saldo-favor`.
3. **Balance**: cuenta como ingreso del día (doc tipo 4 con `bCredito = false`).

## Modelo de datos

Documento **`IdTipoDocumento = 4` ("Saldo a favor")**:
- `bCredito = false`, `IdCliente = <cliente>`, `Estado = 1`.
- `Total` = monto del anticipo; `Saldo` = crédito **disponible** (= Total al
  crearse; baja al consumirse en Fase 2).
- `IdCaja` = caja activa (dinero recibido → arqueo e ingreso del día).
- `IdNegocio` = sucursal activa.

Saldo a favor disponible de un cliente = `SUM(Saldo)` de sus docs tipo 4 con
`Saldo > 0` y `Estado = 1`.

**Sin migración SQL**: se inserta directo (como `/api/gastos`), no hace falta RPC.

## Implementación (Fase 1)

- **API** `POST /api/saldo-favor` — valida caja abierta + cliente + monto;
  inserta el doc tipo 4 (`Saldo = Total`) con `auditCreate` e `IdCaja`.
- **Página** `/saldo-favor` — selector de cliente (bottom sheet
  `ClienteSelectorSheet`, con buscar/crear), monto, concepto, fecha y método de
  pago (default Efectivo). Botón deshabilitado sin cliente o monto.
- **Acceso**: ítem "Saldo a favor" en `NavMenu` (grupo Principal) + título en
  `app-shell`.
- **Visualización**: `VentaListItem` muestra badge "A favor" (violeta) para el
  tipo 4; `venta-detalle` reconoce el tipo 4 y no permite editar/eliminarlo
  (anulación = Fase 2).
- `venta-abono` queda **sin cambios**.

## Pendientes / Fase 2 (consumir)

1. Aplicar el saldo a favor a deudas/ventas futuras sin volver a mover caja.
2. Mostrar "este cliente tiene X a favor" en su ficha / en `venta-abono`.
3. UX para anular/editar un saldo a favor (hoy el doc tipo 4 no es editable).
