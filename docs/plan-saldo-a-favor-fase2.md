# Plan — Saldo a favor Fase 2: consumir el crédito (en venta-abono)

Fecha: 2026-06-06
Base: [plan-saldo-a-favor.md]. Decisión: el consumo vive en **venta-abono**.
Estado: **implementado** (pendiente aplicar migración + probar).

## Decisiones (validadas con el usuario)

1. **Arqueo**: el saldo a favor capturado (tipo 4) **sí** cuenta como efectivo
   (se arregla `fn_caja_arqueo`).
2. **UI**: **botón simple** "Usar saldo a favor" → aplica `min(disponible,
   deuda)` de un toque.
3. **Mecanismo**: documento **tipo 6** separado ("Abono con saldo a favor").

## Estado de implementación

- Migración `20260606120000_aplicar_saldo_favor.sql`: RPC `aplicar_saldo_favor`
  (+ `fn_caja_arqueo` ahora suma tipo 4).
  - El consumo del crédito se hace **vía items** que referencian los docs tipo 4
    (no UPDATE manual): el trigger mantiene su `Saldo`. Así, al **eliminar** el
    documento tipo 6 (cascada + trigger) se restauran **deuda y crédito** solos
    → **anular = eliminar**.
- `documentoService.aplicarSaldoFavor` + `getSaldosFavor(…, idCliente?)`;
  `eliminarAbono` ahora acepta tipo 2 **y 6** (borrado físico).
- `POST /api/saldo-favor/aplicar` (caja abierta requerida) y
  `GET /api/saldo-favor?idCliente=`.
- `venta-abono`: card "Saldo a favor disponible" con botón "Usar X" (solo alta).
- **Visibilidad / no conteo**: el tipo 6 **se ve** en la lista de la home (badge
  "Pago a favor", violeta) pero **no suma** al `totalEfectivo`.
- `venta-detalle`: tipo 6 se puede **ver y eliminar** (anular), **no editar**.

⚠️ **Pendiente operativo**: aplicar la migración en Supabase y probar el consumo
end-to-end (incluido arqueo y el borrado = anulación).

## Objetivo

Usar el saldo a favor de un cliente para **pagar sus deudas** desde
`venta-abono`, sin que el dinero se cuente dos veces.

## Hallazgos de EXPLORE (contabilidad)

- **Trigger** `fn_actualizar_saldo_total_abono`: el `Saldo` de una deuda =
  `Total − SUM(MontoAbono)` de **todos** los `DocumentoItem` activos que la
  referencian (`IdDocumentoRef`), sin importar el tipo del doc padre. → Crear un
  item que referencie la deuda la "paga".
- **Arqueo** `fn_caja_arqueo`: cuenta como efectivo solo documentos tipo 1/2/3,
  con `IdCaja = caja` y método `bEfectivo = TRUE`.
- **Home / ingreso del día** (`page.tsx`): `ingresos = tipo ≠ 3`;
  `totalEfectivo = ingresos.filter(!bCredito).Total`.

### Hueco detectado en Fase 1

El saldo a favor capturado (tipo 4) **no entra en `fn_caja_arqueo`** (solo suma
tipos 1/2/3). Es decir: el efectivo recibido al capturar un saldo a favor no se
refleja en el monto esperado de la caja → diferencia al cerrar. Hay que
**incluir el tipo 4 como entrada de efectivo** en el arqueo.

## Principio contable

- **Capturar** saldo a favor = dinero entra → cuenta como efectivo (caja) e
  ingreso del día. (Falta arreglar el arqueo.)
- **Consumir** saldo a favor = NO entra dinero (ya se contó). Paga una deuda
  pero **no** suma a caja ni al ingreso del día. Efecto: baja el `Saldo` de la
  deuda y baja el `Saldo` disponible del doc tipo 4.

## Diseño propuesto

### Mecanismo de consumo (RPC `aplicar_saldo_favor`)

En una transacción, para un cliente (o una venta) con monto `p_monto`:
1. Valida `disponible = SUM(Saldo)` de sus docs tipo 4 (`Saldo > 0`) ≥ `p_monto`.
2. **FIFO sobre las deudas** (más antigua primero): crea un `Documento`
   **tipo 6 ("Abono con saldo a favor")** con `DocumentoItem`(s) que referencian
   cada deuda (`MontoAbono`) → el trigger baja el `Saldo` de la deuda.
   - `bCredito = false`, `IdMetodoPago = NULL`, `IdCaja = NULL`.
3. **FIFO sobre los docs tipo 4** (más antiguo primero): decrementa su `Saldo`
   por el monto consumido.

### Por qué tipo 6 separado

- **Arqueo**: solo cuenta tipos 1/2/3 → el tipo 6 queda excluido
  automáticamente (no es dinero nuevo). ✓
- **Home/ingreso**: hay que **excluir el tipo 6** del `totalEfectivo` (si no,
  doble conteo). Se muestra en la lista con badge propio.
- Identificable y trazable; el trigger igual baja la deuda (usa el item, no el
  tipo del padre).

### UI en `venta-abono`

- Al cargar el cliente/venta, calcular su **saldo a favor disponible**.
- Si hay disponible > 0, mostrar una sección "Saldo a favor disponible: X" con un
  control para **aplicar** parte/todo a la deuda (separado del "Monto a abonar"
  en efectivo).
- Permite: pagar todo con efectivo, todo con saldo a favor, o mixto.
- Al confirmar: el efectivo va por `/api/abonos` (como hoy) y la parte de saldo a
  favor por `/api/saldo-favor/aplicar` (nuevo) → RPC `aplicar_saldo_favor`.

### Cambios de lectura

- `fn_caja_arqueo`: **sumar el tipo 4** como entrada de efectivo (arregla Fase 1).
- `page.tsx` (home): excluir tipo 6 del `totalEfectivo`.
- `VentaListItem` / `venta-detalle`: reconocer tipo 6 ("Pagado con saldo a favor").

## Archivos afectados

| Capa | Archivo |
|---|---|
| RPC | nueva migración `aplicar_saldo_favor` + update `fn_caja_arqueo` (tipo 4) |
| Servicio | `documento-service` (aplicarSaldoFavor) |
| API | `POST /api/saldo-favor/aplicar` |
| UI | `venta-abono/page.tsx` (sección usar saldo a favor) |
| Lectura | `page.tsx` (excluir tipo 6), `VentaListItem`, `venta-detalle` |

## Decisiones a validar

1. **Arqueo Fase 1**: ¿incluir el tipo 4 (capturado) como efectivo en el arqueo?
   (recomendado: sí — el dinero está en el cajón).
2. **UI**: ¿control para aplicar un monto de saldo a favor + efectivo por
   separado (mixto), o un simple botón "usar saldo a favor disponible"?
3. **Mecanismo**: ¿documento tipo 6 separado (recomendado) u otra marca?
4. **Anulación** (futuro): qué pasa al anular una venta/abono pagado con saldo a
   favor (devolver crédito) — se puede diferir.
