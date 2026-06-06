# Análisis — Lista de saldo a favor + bloqueo por caja en movimientos

Fecha: 2026-06-06
Estado: **implementado** (pendiente aplicar migración + probar).
Base: [plan-saldo-a-favor.md], [plan-saldo-a-favor-fase2.md].

## Estado de implementación

- **DB**: migración `20260606140000_bloquear_caja_cerrada.sql` — trigger
  `BEFORE UPDATE/DELETE` en `Documento` que bloquea editar (campos de negocio) o
  eliminar movimientos de una **caja cerrada**; respeta el recálculo de
  `Saldo`/`TotalAbono` (solo bloquea si cambian Total/IdCliente/Concepto/
  FechaEmision/IdMetodoPago/Estado).
- **Servicio**: `getSaldosFavor` devuelve filas completas (`SaldoFavorRow`);
  `editarSaldoFavor` (solo monto, valida no usado) y `eliminarSaldoFavor`.
- **API**: `GET /api/saldo-favor` (lista), `PUT`/`DELETE /api/saldo-favor/[id]`
  (validan caja abierta + no usado; el trigger es el backstop en DB).
- **UI**: `/saldo-favor` ahora es **lista** con botón Crear (sheet), Editar
  (sheet, solo monto) y Eliminar por fila; cada fila es editable/eliminable solo
  si `IdCaja === cajaAbierta.id` y no fue usado, si no muestra "Utilizado" /
  "Caja cerrada".
- **venta-detalle**: `canEdit`/`canDelete` ahora exigen `cajaOk` (su caja
  abierta) para todo movimiento; el tipo 6 (sin caja) queda exento.

⚠️ **Pendiente operativo**: aplicar la migración `20260606140000` en Supabase y
probar (editar/eliminar con caja abierta vs cerrada; saldo a favor usado vs no).

## Decisiones tomadas (usuario)

1. **Editar saldo a favor = solo el monto.** Para cambiar el cliente → eliminar
   y volver a crear.
2. **Crear** desde un **sheet** en la misma lista (no sub-ruta).
3. La regla **"caja abierta"** para editar/eliminar aplica a **todo movimiento de
   caja** (ventas, abonos, gastos, saldo a favor), no solo al saldo a favor.
4. Validación en **backend + base de datos** (no solo UI).

## Dato confirmado

Todos los movimientos guardan `IdCaja` al crearse (ventas, edición de venta,
gastos, saldo a favor, abonos). → La regla por caja es aplicable a todos.

## A. Lista de saldo a favor (`/saldo-favor`)

- `/saldo-favor` pasa de "solo formulario" a **lista** de documentos tipo 4:
  cliente, monto (`Total`), disponible (`Saldo`), usado (`Total − Saldo`), fecha,
  estado (Disponible / Usado).
- Botón **Crear** → abre un **sheet** con el formulario actual (cliente + monto +
  concepto + fecha + método).
- Por fila: **Editar** (solo monto) y **Eliminar**, habilitados según las
  condiciones de abajo; si no, fila en solo lectura con el motivo.

## B. Regla "caja abierta" (uniforme para editar/eliminar)

Un movimiento es **editable/eliminable** solo si:
```
doc.IdCaja === cajaAbierta?.id        // su caja sigue abierta (misma sesión/día)
```
- Si su caja ya cerró (o no hay caja abierta) → **solo lectura**.
- Aplica a ventas / abonos / gastos / saldo a favor.
- Motivo: editar/eliminar un movimiento de una caja **cerrada** alteraría un
  arqueo ya sellado (`MontoEsperado` se fija al cerrar).

## C. Condiciones específicas del saldo a favor (tipo 4)

Además de la caja abierta, para editar/eliminar un saldo a favor:
```
no_usado = (Total − Saldo) < 0.01      // en SQL (NUMERIC): Total = Saldo
```
- Si fue consumido (total o parcial) por un pago tipo 6 → **bloqueado** (rompería
  la matemática del crédito).
- Editar: al no estar usado, `Saldo = Total`, así que cambiar el monto actualiza
  ambos.
- Eliminar: el tipo 4 no usado **no tiene items** → borrado físico directo (no
  hay cascada/trigger que reponer); solo afecta el arqueo de su caja abierta.

## D. Validación en backend + base de datos

### Backend (endpoints / RPC)
Los endpoints `PUT`/`DELETE` re-verifican **antes** de actuar:
- doc del tipo correcto,
- caja abierta y `doc.IdCaja === cajaAbierta.id`,
- (saldo a favor) no usado.

### Base de datos (garantía dura) — ⚠️ con cuidado
Un trigger `BEFORE UPDATE OR DELETE ON "Documento"` que bloquee si la caja del
documento está cerrada.

**Riesgo crítico**: el trigger existente `fn_actualizar_saldo_total_abono`
**actualiza** `Saldo`/`TotalAbono` de documentos al registrar/anular abonos —
incluso de ventas viejas cuya caja ya cerró (ej.: abonar hoy una venta a crédito
de ayer). Un bloqueo general por "caja cerrada" **rompería** ese recálculo
legítimo.

→ El trigger de bloqueo debe disparar **solo si cambian campos de negocio**
(`Total`, `IdCliente`, `Concepto`, `FechaEmision`, `IdMetodoPago`, `Estado`) y
**no** cuando solo cambian `Saldo`/`TotalAbono` (recálculo interno). En `DELETE`
sí bloquear directo (el `DELETE` de `Documento` siempre es explícito; la cascada
solo borra `DocumentoItem`, no otros `Documento`).

Esbozo:
```sql
-- BEFORE UPDATE: bloquear solo edición de campos de negocio si caja cerrada
IF (NEW."Total" IS DISTINCT FROM OLD."Total"
    OR NEW."IdCliente" IS DISTINCT FROM OLD."IdCliente"
    OR NEW."Concepto" IS DISTINCT FROM OLD."Concepto"
    OR NEW."FechaEmision" IS DISTINCT FROM OLD."FechaEmision"
    OR NEW."IdMetodoPago" IS DISTINCT FROM OLD."IdMetodoPago"
    OR NEW."Estado" IS DISTINCT FROM OLD."Estado")
   AND OLD."IdCaja" IS NOT NULL
   AND EXISTS (SELECT 1 FROM "Caja" WHERE id = OLD."IdCaja" AND "Estado" = 0)
THEN RAISE EXCEPTION 'Movimiento de una caja cerrada: no se puede modificar';
END IF;
-- (saldo a favor usado: si tipo 4 y Total<>Saldo y se edita Total → bloquear)
```

## E. Casos borde / riesgos

- El trigger de bloqueo debe respetar el recálculo de `Saldo` (ver D). Es el
  punto más delicado; probar abonar/anular sobre ventas de cajas cerradas.
- "Movimiento efectivo": la consistencia del arqueo solo importa para métodos
  `bEfectivo`. Aplicar la regla a TODOS los movimientos (con `IdCaja`) es más
  uniforme y simple; aplicarla solo a efectivo sería más permisivo. (Decidido:
  todo movimiento.)
- Editar el monto de un saldo a favor recalcula ingreso del día + arqueo (por eso
  solo con caja abierta).
- Coherencia: hoy ventas/abonos/gastos NO chequean caja para editar/eliminar;
  esto agrega esa restricción a todos.

## F. Cambios que implicaría (cuando se apruebe)

| Capa | Qué |
|---|---|
| DB | Trigger `BEFORE UPDATE/DELETE` de bloqueo por caja cerrada (cuidando el recálculo) |
| API | GET lista tipo 4 completa; PUT (editar monto) y DELETE (tipo 4) con validación; revisar PUT/DELETE de ventas/abonos/gastos para el chequeo de caja |
| UI | `/saldo-favor` lista + sheet crear + editar/eliminar por fila; helper "movimiento editable" reutilizable según caja |

## Pendientes / decisiones abiertas

1. ¿El bloqueo por caja aplica también a métodos NO efectivo (transferencia/
   tarjeta)? (Decidido: a todo movimiento — confirmar que incluye no-efectivo.)
2. Mensajes de UI para fila bloqueada ("ya utilizado" vs "caja cerrada").
3. ¿Editar saldo a favor permite también cambiar concepto/fecha/método, o
   estrictamente solo el monto? (Decidido: solo monto.)
