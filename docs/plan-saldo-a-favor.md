# Plan de implementación — Saldo a favor (sobrepago)

Fecha: 2026-06-05
Base: análisis previo del flujo de abonos (conversación). Decisión validada:
**Opción A** — la cancelación de deuda se mantiene tal cual; el excedente se
guarda como un registro aparte.
Estado: **Fase 1 implementada** (pendiente aplicar migración + probar).

## Estado de implementación (Fase 1)

Implementado:
- Migración `supabase/migrations/20260605120000_registrar_abono_saldo_favor.sql`
  (redefine `registrar_abono`: FIFO igual + excedente → Documento tipo 4).
- `documento-service.registrarAbono` devuelve `saldo_favor_id` / `saldo_favor`.
- `POST /api/abonos` vincula a caja también el doc de saldo a favor.
- `venta-abono/page.tsx`: permite sobrepago en alta (no en edición), muestra
  desglose "Cancela deuda / Saldo a favor" y toast con el monto a favor.
- `VentaListItem` y `venta-detalle` reconocen tipo 4 ("A favor"); el detalle no
  permite editar/eliminar el doc de saldo a favor (anulación = Fase 2).

⚠️ **Pendiente operativo**: aplicar la migración en Supabase (no se ejecuta desde
el código) y **probar** el flujo de sobrepago end-to-end antes de usar en prod.

## Objetivo

Permitir registrar un pago mayor a la deuda. El excedente queda como **saldo a
favor** del cliente y puede consumirse en deudas/ventas futuras.

Ejemplo: deuda 150.000, paga 200.000 → 150.000 cancelan deuda (igual que hoy) +
50.000 saldo a favor.

## Principio rector

La lógica de **cancelación de deuda no se toca**:
- El loop FIFO (`registrar_abono`) sigue igual: cada deuda recibe
  `LEAST(restante, Saldo)`; ninguna venta queda con Saldo negativo.
- El trigger `trg_actualizar_saldo_total_abono` y `Saldo = Total − Σ abonos`
  intactos.
- "Deuda" sigue siendo `bCredito = true AND Saldo > 0`.

Lo único que cambia respecto a hoy: **dejar de rechazar el excedente** y, en su
lugar, **enrutarlo** a un registro de saldo a favor.

## Modelo de datos (propuesta)

Nuevo documento **`IdTipoDocumento = 4` ("Saldo a favor"/anticipo)**:
- `bCredito = false`, `IdCliente = <cliente>`.
- `Total` = monto original del saldo a favor (ej. 50.000).
- `Saldo` = saldo a favor **disponible** (arranca = Total; baja al consumirse).
- `IdNegocio` heredado de la sucursal activa / deuda.
- Vinculado a la caja activa (es dinero real recibido → arqueo).

Ventajas: reusa la infra de `Documento` (caja, auditoría, multi-sucursal) sin
tablas nuevas; los embeds y servicios existentes aplican.

El saldo a favor disponible de un cliente = `SUM(Saldo)` de sus documentos
tipo 4 con `Saldo > 0` y `Estado = 1`.

## Fase 1 — Capturar el excedente (MVP)

### RPC `registrar_abono`
- Quitar/relajar el `RAISE EXCEPTION 'El monto ingresado es mayor a la deuda'`.
- Tras el loop FIFO, si `v_restante > 0`, insertar **un** `Documento` tipo 4
  con `Total = Saldo = v_restante`, `IdCliente`, caja/negocio.
- Devolver su id (p. ej. `saldo_favor_id`) además de `abonos`.
- *Sin saldo a favor* (pago ≤ deuda): comportamiento idéntico al actual.

### API `POST /api/abonos`
- Dejar pasar `Total` mayor a la deuda.
- Vincular a la caja tanto los abonos como el doc de saldo a favor (arqueo).

### UI `venta-abono/page.tsx`
- Quitar los topes `total > totalDeuda` (botón `disabled` y validación).
- Mostrar, cuando `total > totalDeuda`, un desglose claro:
  "Cancela deuda: 150.000 · Saldo a favor: 50.000".

### Lectura / visibilidad
- Mostrar el saldo a favor del cliente donde corresponda (página de deuda,
  detalle de cliente, o `venta-abono`). No entra en `fn_deuda_resumen` (es lo
  contrario a deuda); se expone como dato aparte.

## Fase 2 — Consumir el saldo a favor (diseño, posterior)

Al registrar un abono o una venta a crédito de un cliente con saldo a favor:
- Ofrecer "usar saldo a favor disponible".
- Aplicarlo genera abono(s) FIFO **financiados por el saldo a favor**, que
  decrementan el `Saldo` del documento tipo 4 — **sin** mover caja (el dinero ya
  se contabilizó al capturarlo).

Esta fase es la más delicada por la contabilidad de caja (no doble-contar) y se
detallará en un plan aparte antes de implementarla.

## Casos borde / riesgos

- **Arqueo de caja**: el doc de saldo a favor SÍ suma a la caja al capturarse;
  al consumirse (fase 2) NO debe volver a sumar. Hay que separar ambos momentos.
- **Editar/eliminar abono**: hoy es 1:1 abono↔deuda con borrado físico (cascada
  + trigger restauran Saldo). El doc de saldo a favor es **independiente**: se
  edita/elimina por separado (borrarlo solo quita el crédito, no afecta deudas).
  Falta definir UX para anular un sobrepago completo.
- **Reportes / balance home**: decidir si el saldo a favor capturado cuenta como
  ingreso del día (probablemente sí, como los abonos).
- **IdTipoDocumento = 4**: verificar que no esté en uso y mapear el dominio en
  `types/database.ts` y en cualquier filtro que asuma 1/2/3.

## Archivos afectados (Fase 1)

| Capa | Archivo |
|---|---|
| RPC | nueva migración `..._registrar_abono_saldo_favor.sql` (redefine `registrar_abono`) |
| Servicio | `src/services/documento-service.ts` (`registrarAbono` → nuevo retorno; `setIdCaja` del doc favor) |
| API | `src/app/api/abonos/route.ts` |
| UI | `src/app/venta-abono/page.tsx` |
| Tipos | `src/types/database.ts` |
| Lectura | vista/endpoint para exponer saldo a favor del cliente |

## Decisiones tomadas (validadas con el usuario)

1. **Representación**: documento `IdTipoDocumento = 4` (reusa `Documento`).
2. **Alcance ahora**: solo **Fase 1 (capturar)**; la Fase 2 (consumir) se difiere.
3. **Balance**: el saldo a favor capturado **cuenta como ingreso del día**, igual
   que un abono (doc tipo 4 con `bCredito = false` → ya entra en `totalEfectivo`
   de la home al aparecer en la lista de ingresos).

## Pendientes / próximas decisiones (Fase 2)

1. Consumo: automático en el próximo abono vs manual "usar saldo a favor".
2. UX para anular un sobrepago completo (abonos 1:1 + doc de saldo a favor).
3. Contabilidad de caja al consumir (no doble-contar).
