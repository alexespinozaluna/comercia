# Propuesta: Abono multi-detalle (un pago = un documento con varios detalles)

**Fecha:** 2026-07-11
**Estado:** ✅ Implementado, migraciones `20260711000000_abono_multi_detalle.sql` y `20260711010000_abono_ref_descripcion.sql` **aplicadas y verificadas en runtime (2026-07-11)**.
**Objetivo de negocio:** poder responder con exactitud *"¿con cuánto abonó el cliente?"* representando el pago del cliente como **una sola entidad**, en lugar de N documentos dispersos.

> **Decisiones tomadas al implementar:**
> - **Función separada (no se modifica `registrar_abono`):** el modelo multi-detalle vive en una función NUEVA `registrar_abono_multi_item`. La original `registrar_abono` (1:1, un Documento por deuda) queda **intacta y disponible** en la BD. Así el cambio de contrato (N documentos → 1) es explícito y reversible (basta reapuntar el service), sin alterar la función establecida.
> - **#1 →** el abono de **una sola deuda sigue editable** (form `/venta-abono?idAbono=`); el **multi-detalle es solo-eliminar**. Se expuso el botón "Editar" en `venta-detalle` únicamente cuando el abono tiene 1 item.
> - **#2 →** se **mantiene el borrado físico** (status quo de `eliminarAbono`): la cascada + trigger restauran los saldos. No se migró a soft-delete; queda revisable si más adelante se quiere conservar el histórico de pagos corregidos.
>
> **Archivos tocados:** `supabase/migrations/20260711000000_abono_multi_detalle.sql` (**nueva** función `registrar_abono_multi_item`), `src/services/documento-service.ts` (`registrarAbono` ahora llama a `registrar_abono_multi_item`; JSDoc), `src/app/venta-detalle/[id]/page.tsx` (botón Editar para abono de 1 item). Sin cambios en `registrar_abono`, el trigger, `modificar_abono`, `/api/abonos`, ni la captura de alta (`venta-abono` alta y `reportes.ts` ya eran compatibles).
>
> **Sobre DRY (no aplica aquí):** aunque las dos funciones comparten el reparto FIFO, **no hay duplicación viva**. `registrar_abono` deja de usarse (el service ya llama a `registrar_abono_multi_item`) y queda **congelada como backup** del proceso anterior. La duplicación que prohíbe DRY es la de dos copias vivas que deben evolucionar juntas; aquí solo hay una activa. Un arreglo futuro al FIFO se hace únicamente en la nueva función. End-state opcional: eliminar `registrar_abono` cuando el multi-item esté validado en producción.

---

## Seguimiento (2026-07-11): descripción "Ref" + enlace a la venta

Sobre el modelo multi-detalle ya funcionando, se rediseñó el **texto de cada ítem de abono** y se hizo **navegable** a la venta que paga.

- **Antes:** `Abono {Cliente} — Venta #00042 (50%)`
- **Ahora:** `Ref: 05/07/25 · Venta #00042 (50%)` — la fecha es la **FechaEmisión de la venta** referenciada; el número es su id (zero-pad 5); el % = `MontoAbono / venta.Total`. El nombre del cliente se quita del ítem (ya está en la cabecera del documento de abono).

**Opción elegida: 1 (texto horneado en el RPC).** El formato de fecha `DD/MM/YY` coincide con `fechaString`, así que no hay conflicto de locale. El enlace se resuelve en el frontend con `DocumentoItem.IdDocumentoRef` (que ya llegaba al cliente) → **sin cambios de API**.

**Cambios:**
- `supabase/migrations/20260711010000_abono_ref_descripcion.sql` — nuevo formato en `registrar_abono_multi_item` (añade `FechaEmision` al SELECT del loop) y en `modificar_abono` (añade `v_venta_fecha`); **backfill** que reescribe `DocumentoItem.Descripcion` de todos los abonos existentes (tipo 2) al formato `Ref`. El backfill **no** toca el `Concepto` del documento padre (puede ser texto del usuario).
- `src/app/venta-detalle/[id]/page.tsx` — en abonos, cada ítem es un botón que navega a `/venta-detalle/{IdDocumentoRef}`; encabezado del bloque pasa de "Productos" a **"Deudas cubiertas"**; se oculta la línea `und / Precio U.` y se añade un chevron.

**Decisiones aplicadas:** texto exacto `Ref: 05/07/25 · Venta #00042 (50%)` (separador `·`, se conserva "Venta"); **sí** se backfillean los abonos existentes; `%` se deja en `(0%)` si la venta tuviera `Total = 0` (caso raro, sin rama especial).

**Sin cambios** en el trigger, `/api/abonos`, ni la captura de alta.

---

## 1. Cómo funciona el abono hoy

La escritura vive en la RPC `registrar_abono` (`supabase/migrations/20260526160000_registrar_abono.sql`). La UI (`src/app/venta-abono/page.tsx`) captura **un solo monto global** y el servidor lo distribuye.

Modos según `tipo`:

- `tipo = 1` → abono a **una venta puntual** (`id` = IdDocumento de la venta).
- `tipo = 2` → abono al **total de deudas de un cliente** (`id` = IdCliente).

### Modelo real: N documentos 1:1, NO un documento con varios detalles

Aunque el usuario ingresa un único monto, el sistema **no** crea un abono con varios detalles. Hace lo contrario:

> Por CADA deuda cubierta se crea **un `Documento`** (`IdTipoDocumento = 2`) con **UN solo `DocumentoItem`** que referencia la venta (`IdDocumentoRef`). Relación **1:1 abono↔deuda**.

El reparto es **FIFO** (`ORDER BY "FechaEmision" ASC, id ASC`), tomando `LEAST(restante, Saldo)` en cada deuda. Si un pago cubre 2,5 deudas, se generan 3 documentos de abono independientes.

### Actualización del saldo

No hay descuento manual. El trigger `fn_actualizar_saldo_total_abono`
(`20260527090000_saldo_abono_estado_aware.sql`) recalcula, por cada `IdDocumentoRef`:

```
TotalAbono = SUM(MontoAbono de items ACTIVOS con ese IdDocumentoRef)
Saldo      = Total − TotalAbono
```

Todo corre en una transacción implícita: si algo falla, rollback de todos los abonos.

---

## 2. Por qué está así (y qué falla)

El comentario del código lo declara: **"Relación 1:1 abono↔deuda → fácil de editar/anular después."**

**La razón única del 1:1 es la editabilidad.** `modificar_abono`
(`20260526170000_modificar_abono.sql`) y la UI (`page.tsx:67`) **exigen que el abono tenga exactamente 1 item**, porque reasignar montos entre varias deudas al editar es ambiguo.

**Lo que falla:** el modelo 1:1 es correcto a nivel de *asiento* (da editabilidad, anulación por cascada y trazabilidad), pero **no existe una entidad que represente "el pago que hizo el cliente"**. Si el cliente paga con una transferencia y cubre 3 deudas, quedan 3 filas de abono; el pago único que él percibe no tiene representación en la BD. Responder *"¿con cuánto abonó?"* obliga a reconstruir sumando.

---

## 3. Propuesta: abono multi-detalle con regla "no editar, solo eliminar"

Representar el pago del cliente como **un `Documento` de abono con N `DocumentoItem`**, uno por cada deuda cubierta (cada item con su propio `IdDocumentoRef`). Entonces:

- `Documento.Total` del abono = **con cuánto abonó el cliente** (un solo número real).
- Un solo `IdMetodoPago`, una sola `FechaEmision`, un solo vínculo a `IdCaja`.
- El detalle por venta vive en cada `DocumentoItem`.

### La regla es la pieza clave, no una limitación

> **Un abono multi-detalle NO se edita: solo se elimina (y se rehace si hace falta).**

Como la **única** razón por la que existía el 1:1 era la editabilidad, quitar la edición para el caso multi-detalle **elimina de raíz la ambigüedad** de reasignar montos. La regla no es un parche impuesto: es lo que legitima el modelo.

---

## 4. Por qué encaja con la infraestructura existente

1. **El guard ya existe.** `venta-abono/page.tsx:67` ya detecta `DocumentoItem.length !== 1` y responde *"Este abono no se puede editar (varias deudas)"*. La regla ya está esbozada en el código.

2. **El trigger ya lo soporta sin cambios.** `fn_actualizar_saldo_total_abono` suma `MontoAbono` **por `IdDocumentoRef`**, sin importar el documento padre. N items apuntando a N ventas recalculan correctamente los N saldos.

3. **La eliminación por cascada ya funciona.** El `DELETE` físico borra los items y el trigger restaura el `Saldo` de cada venta afectada. Anular "el pago" devuelve todos los saldos de golpe.

4. **El reparto FIFO no cambia.** `registrar_abono` seguiría recorriendo deudas FIFO con `LEAST(restante, Saldo)`; lo único que cambia es que en vez de `INSERT` de N documentos, hace **1 documento + N items**.

5. **Caja y reporte quedan más limpios.** `setIdCaja` vincularía 1 documento en lugar de N; en el arqueo, el pago del cliente es una línea.

---

## 5. Relación con el "recibo maestro"

Esta propuesta **converge con el patrón contable estándar "payment → allocations"** (recibo maestro + asignaciones 1:1 por deuda), pero en su versión **más barata**: en vez de una tabla padre + tabla de asignaciones, se colapsa el recibo en **un solo `Documento` con 1..N items**. Se conserva el asiento por deuda (cada item), se gana la entidad "pago", y no se añade esquema nuevo.

---

## 6. Puntos a tener en el radar

- **Modelo mixto.** Convivirían dos formas de abono: 1 item = editable, N items = solo-eliminar. Es coherente (el guard ya lo asume). **Decisión abierta #1** más abajo.

- **Concepto y método a dos niveles.** El `Concepto` del padre sería genérico ("Abono de N deudas") y el detalle por venta vive en cada item — más transparente que hoy. El `IdMetodoPago` vive en el padre → el pago tiene **un** método, que es lo deseado.

- **Semántica de conteo en reportes.** Consultas que hoy asuman "1 documento de abono = 1 aporte a 1 deuda" cambian de significado (1 pago vs N aportes). Verificar `src/lib/reportes.ts` y el detalle de deuda para que agreguen por `MontoAbono` de item, no por conteo de documentos. **Los totales no cambian; el número de "abonos" sí.**

- **El FIFO sigue implícito.** El multi-detalle no deja elegir a qué deuda aplicar; el servidor sigue decidiendo antiguo-primero. (El modelo soportaría pago dirigido en el futuro sin cambios estructurales.)

- **Delete físico vs. rastro histórico.** Ver decisión abierta #2.

---

## 7. Decisiones abiertas (a resolver antes de implementar)

### Decisión #1 — ¿El abono de una sola deuda sigue siendo editable?

- **Recomendado: sí.** Mantener editable el abono de 1 item (caso común) y aplicar "solo-eliminar" únicamente a los multi-detalle. Menor disrupción; coherente con el guard actual.
- Alternativa: unificar todo a "delete-only" por simplicidad conceptual (todo pago es 1 documento con 1..N items, ninguno editable). Más simple de explicar, pero es una regresión de UX para el caso más frecuente.

### Decisión #2 — ¿Borrado físico o soft-delete para los abonos multi-detalle?

- El objetivo es *saber con cuánto abonó el cliente*. Si la única corrección es "eliminar y rehacer" con **borrado físico**, se **pierde el rastro** de ese pago histórico.
- Si importa conservar el histórico de pagos aunque se corrijan → considerar **soft-delete** (`Estado = 0`) para estos abonos. Hoy el `DELETE` de abono es **físico** (`documento-service.eliminarAbono`).
- Este es el único punto donde la regla "solo eliminar" roza el propio objetivo de la propuesta.

---

## 8. Alcance estimado de cambios (referencia, no implementación)

| Área | Cambio |
|------|--------|
| `registrar_abono` (RPC) | Insertar **1 documento + N items** en el loop FIFO, en vez de N documentos |
| `modificar_abono` (RPC) | Sin cambios (sigue solo para abonos de 1 item) |
| Trigger de saldo | Sin cambios |
| `venta-abono/page.tsx` | Alta multi-detalle; en detalle, ofrecer "Eliminar" (no "Editar") cuando `items > 1` (guard ya presente) |
| `documento-service` | `registrarAbono` sin cambios de firma; revisar `setIdCaja` (recibe 1 id en vez de N) |
| `reportes.ts` / detalle de deuda | Verificar agregación por `MontoAbono` de item |
| Borrado | Según Decisión #2 (físico actual vs. soft-delete) |

---

## 9. Veredicto

La idea es **acertada y coherente con el código existente**. Se apoya en infraestructura ya presente (trigger agregador por `IdDocumentoRef`, cascada de borrado, guard de UI en `page.tsx:67`) y responde directamente a *"¿con cuánto abonó el cliente?"* con un número real (`Documento.Total`), no una suma reconstruida.

La regla **"no editar, solo eliminar"** no es una restricción impuesta: es precisamente lo que hace válido el modelo multi-detalle, porque retira la única razón por la que existía el 1:1. Se recomienda avanzar tras resolver las dos decisiones abiertas.
