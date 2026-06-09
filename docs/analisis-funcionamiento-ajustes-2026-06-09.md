# Análisis de funcionamiento — Ajustes: Inventario y Baja

**Fecha:** 2026-06-09
**Alcance:** Cómo funcionan las operaciones del módulo `producto/ajustes`.
**Archivos:** `src/components/kardex/registro-baja-form.tsx` (UI),
`src/app/api/ajustes/route.ts` (API/BD), `src/app/producto/ajustes/page.tsx` (listado).
**Relacionado:** [[kardex-stock-fix]], `docs/plan-ajustes-listado-filtro-fechas-2026-06-09.md`.

---

## Terminología (importante)

- **Ajuste** es el **paraguas**: TODA operación de este módulo crea un `Documento`
  con `IdTipoDocumento = 5` (TipoDoc.AJUSTE). No es una tercera operación: es el
  tipo de documento que envuelve tanto a Baja como a Inventario.
- Dentro del formulario hay **dos modos**: **Baja** e **Inventario Físico**.
- Lo que las diferencia en el kardex es el **`TipoMovimiento`** del
  `ProductoMovimiento`, no el documento.

## Reglas comunes a ambos modos

Antes de registrar cualquiera, el API exige:
1. Usuario autenticado y rol **ADMIN o SUPERVISOR**.
2. **Caja abierta** en la sucursal activa.
3. El producto debe **rastrear stock** (`Producto.Cantidad != null`).

Y ambos, al guardar, crean **tres filas** + actualizan stock:
- `Documento` (tipo 5, `Total = 0`, `Concepto = Motivo`).
- `DocumentoItem` (el producto y la cantidad del movimiento).
- `ProductoMovimiento` (la línea del kardex, con `StockAnterior`/`StockNuevo`).
- `UPSERT` en `ProductoStock` de la sucursal activa (= `stockNuevo`).

---

## 1. Baja (modo `baja`)

**Qué hace:** **resta** stock. Se usa cuando perdiste unidades (merma,
vencimiento, daño, robo) o para un descuento manual.

**Qué ingresas:** la **cantidad a descontar** (debe ser > 0 y **no mayor** al
stock actual).

**Motivos:** `Merma`, `Vencimiento`, `Daño`, `Robo`, `Ajuste de Inventario`.

**Tipo de movimiento que genera:**
- `Vencimiento` → **tipo 5** (Vencimiento).
- todos los demás → **tipo 4** (Merma / Daño).

**Cálculo:**
```
cantidadMovimiento = Cantidad (la que ingresaste)
stockNuevo         = stockAnterior − Cantidad
```

> ⚠️ La Baja **nunca sube** el stock. El motivo "Ajuste de Inventario" sigue
> siendo una salida (resta). Si necesitas **aumentar** stock, usa Inventario
> Físico (o una Compra).

### Ejemplo — Baja por Merma
Producto "Coca-Cola 600ml", stock actual **50**. Registras Baja de **5** por
"Merma":
- `ProductoMovimiento`: tipo **4**, `Cantidad = 5`, `StockAnterior = 50`,
  `StockNuevo = 45`.
- `ProductoStock` queda en **45**.
- En el listado se ve: `Merma / Daño  −5   Stock: 50 → 45`.

### Ejemplo — Baja por Vencimiento
Stock **30**, das de baja **4** por "Vencimiento":
- `ProductoMovimiento`: tipo **5**, `30 → 26`, `Cantidad = 4`.

---

## 2. Inventario Físico (modo `inventario`)

**Qué hace:** **fija** el stock al valor que **contaste físicamente**. El sistema
calcula la diferencia y la aplica; puede **subir o bajar** el stock.

**Qué ingresas:** la **cantidad contada** (absoluta, ≥ 0). Debe ser **distinta**
del stock actual (si es igual, no hay nada que ajustar y el API lo rechaza).

**Motivos:** `Inventario Fisico`, `Reconteo`.

**Tipo de movimiento que genera:** siempre **tipo 6** (Inventario Físico,
operación AJUSTE).

**Cálculo:**
```
diferencia         = cantidadContada − stockAnterior
cantidadMovimiento = |diferencia|        (lo que muestra el kardex)
stockNuevo         = cantidadContada     (el valor absoluto que contaste)
```

La `Observacion` del movimiento guarda el detalle:
`Inventario: conteo=42, anterior=45, diferencia=-3`.

### Ejemplo — Conteo MENOR al sistema (faltante)
El sistema dice **45**, pero al contar hay **42**:
- `diferencia = −3` → egreso.
- `ProductoMovimiento`: tipo **6**, `Cantidad = 3`, `StockAnterior = 45`,
  `StockNuevo = 42`.
- `ProductoStock` queda en **42**.

### Ejemplo — Conteo MAYOR al sistema (sobrante)
El sistema dice **42**, pero al contar hay **50**:
- `diferencia = +8` → ingreso.
- `ProductoMovimiento`: tipo **6**, `Cantidad = 8`, `StockAnterior = 42`,
  `StockNuevo = 50`.
- `ProductoStock` queda en **50**.

> Este es el modo correcto para **corregir stock negativo o erróneo**: cuentas lo
> real y el sistema lo fija, dejando el ajuste auditado en el kardex (es el
> "ancla" que usaron los scripts de reconstrucción del stock).

---

## 3. Comparativa rápida

| | **Baja** | **Inventario Físico** |
|---|---|---|
| Qué ingresas | cantidad a descontar | cantidad **contada** (absoluta) |
| Dirección | siempre **resta** | **sube o baja** según diferencia |
| TipoMovimiento | **4** (Merma/Daño/Robo/Ajuste) o **5** (Vencimiento) | **6** (Inventario Físico) |
| Cantidad del kardex | la que ingresaste | **\|diferencia\|** |
| StockNuevo | actual − cantidad | = lo contado |
| Restricción | `0 < cantidad ≤ stock` | `contado ≥ 0` y `contado ≠ actual` |
| Motivos | Merma, Vencimiento, Daño, Robo, Ajuste de Inventario | Inventario Fisico, Reconteo |
| Documento | tipo 5 (Ajuste) | tipo 5 (Ajuste) |

## 4. Notas / consideraciones

- **Tipo 3 (Fabricación)** aparece en el listado de ajustes (se incluyó por
  decisión), pero **este formulario no lo genera** hoy; vendría de otro flujo.
- El stock se escribe en `ProductoStock` **por sucursal**; si la sesión no trae
  sucursal (token viejo), cae al legacy `Producto.Cantidad`.
- El `Documento` de tipo 5 tiene `Total = 0` y `bCredito = false`: es un
  movimiento de inventario, **no** afecta caja ni deuda.
- En el nuevo listado (`/api/ajustes`), Baja e Inventario se distinguen por el
  `TipoMovimiento`/etiqueta, no por el documento.

---

## 5. Efecto de borrar un ajuste a mano (SQL directo)

**Resumen: borrar un ajuste por BD NO revierte el stock; solo destruye el rastro
y rompe la cadena del kardex.**

Razón: el trigger de stock (`fn_registrar_movimiento_stock`) **solo actúa sobre
ventas** (`IdTipoDocumento = 1`). Los ajustes (tipo 5) **no pasan por ningún
trigger**: su efecto sobre `ProductoStock` lo aplica a mano el API
(`/api/ajustes`) en el INSERT. Por eso ningún DELETE de un ajuste dispara una
reversión automática.

| Qué borras | `ProductoStock` | Kardex | Riesgo |
|---|---|---|---|
| Solo el `ProductoMovimiento` (tipo 6) | **NO cambia** (queda en el valor fijado) | salto inexplicable (cadena rota) | re-derivación futura da resultado erróneo |
| `Documento` + `Item` + `Movimiento` | **NO cambia** | desaparece el registro | + posibles huérfanos/FK |

### Peligro real (post-reconstrucción)

El Inventario Físico es el **ancla de confianza** de los scripts de
reconstrucción (`reconstruir-stock-desde-movimientos`): su `StockNuevo` es el
conteo absoluto real. Si se borra, una futura re-derivación de stock desde los
movimientos vuelve a dar un saldo erróneo (probablemente negativo).

**Ejemplo:** el sistema decía **−12**; haces Inventario contando **50**
(`StockAnterior −12 → StockNuevo 50`, `Cantidad 62`, `ProductoStock = 50`). Si
borras ese movimiento por SQL: `ProductoStock` sigue en 50, pero el kardex ya no
explica el salto y una re-derivación lo recalcula a −12, "corrigiendo" tu stock
bueno a uno malo.

### Vía correcta

Para deshacer/corregir un inventario, **registrar otro Inventario Físico** (o
Baja/Compra) con el valor correcto: la corrección queda auditada y `ProductoStock`
se ajusta por la vía normal. **Nunca borrar a mano.**

---

## 7. Implementado (2026-06-09)

Decidido: **opción A acotada** — el trigger existente maneja ajustes **solo en
DELETE/anulación**; el INSERT lo sigue haciendo `/api/ajustes` (sin doble conteo).
Además se sacaron los ajustes del flujo de ventas.

**BD — `supabase/migrations/20260609000000_kardex_ajustes_delete.sql`** (pendiente
de aplicar): `CREATE OR REPLACE` de `fn_registrar_movimiento_stock` (ventas igual
que antes) + nuevo helper `fn_revertir_ajuste_stock`. Para documentos tipo 5:
- INSERT → no hace nada.
- DELETE (hard) → revierte stock (si el item estaba activo) y **borra** el
  `ProductoMovimiento` (kardex limpio).
- UPDATE 1→0 (anular) → revierte stock (deja el movimiento).
- UPDATE 0→1 (restaurar) → re-aplica stock.
El delta se lee del propio movimiento: `StockNuevo − StockAnterior`.

**App — ajustes fuera del flujo de ventas:**
- `src/services/documento-service.ts` → `getVentas` añade
  `.neq("IdTipoDocumento", AJUSTE)`: los ajustes ya no salen en el feed.
- `src/app/api/ventas/[id]/route.ts` → **PUT** rechaza (403) si el documento no
  es venta (antes lo reescribía como venta); **DELETE** rechaza (400) si es
  ajuste (se anula desde Stock).
- `src/app/venta-detalle/[id]/page.tsx` → `isAjuste` excluye Editar/Eliminar.

> Recordatorio (límite inherente): el trigger es sobre `DocumentoItem`, así que
> esto cubre el borrado/anulación **vía la app** (Estado) o el borrado del
> Documento/Item por SQL. Borrar **directamente la fila de `ProductoMovimiento`**
> sigue sin revertir (no hay trigger sobre esa tabla, por decisión).

## 6. Consideración en el trigger (propuesta original — resuelta en §7)

Hoy el trigger ignora los ajustes, así que borrarlos deja `ProductoStock`
inconsistente con el kardex. Por qué un trigger sobre `DocumentoItem` **no
basta**: el `DocumentoItem` de un ajuste solo guarda `Cantidad` (siempre
positiva) — no sabe si fue Baja (resta) o Inventario (fija absoluto). Esa
información (dirección y delta) vive en el `ProductoMovimiento`
(`StockNuevo − StockAnterior`).

Opciones (cada una con su trade-off):

- **A — Trigger de reversa en `ProductoMovimiento`** (recomendada para el
  síntoma): `AFTER DELETE/UPDATE` sobre `ProductoMovimiento` para tipos ≠ 1,7
  (ajustes/compras) que revierte el delta en `ProductoStock`
  (`Cantidad -= (StockNuevo − StockAnterior)`). Borrar a mano un ajuste deja el
  stock consistente automáticamente. Excluye ventas (1/7) para no chocar con el
  trigger de `DocumentoItem` ni con el script de limpieza. INSERT lo sigue
  haciendo el API (sin doble conteo).
- **B — Trigger de bloqueo (guard)**: `BEFORE DELETE` en `ProductoMovimiento` de
  ajustes lanza excepción → impide el borrado manual y obliga a usar
  contra-inventario. Más conservador; no "arregla" nada, lo previene.
- **C — Unificar bajo trigger simétrico** (refactor): mover TODA la lógica de
  stock de `/api/ajustes` al trigger, como ya hacen las ventas (INSERT/UPDATE/
  DELETE simétrico, todo por deltas). Lo más limpio y coherente a futuro, pero
  el cambio más grande y con más riesgo.

### Pendientes / próximas decisiones

- ¿Cuál opción (A / B / C)?
- Si A: ¿incluir también compras/stock inicial (tipo 2) en la reversa, o solo
  ajustes 3-6?
- Recordar: el script de limpieza de ventas borra movimientos tipo 1/7; al
  excluirlos en A/B no hay interferencia.
