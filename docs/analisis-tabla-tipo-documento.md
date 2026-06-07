# Análisis — Creación de la tabla `TipoDocumento`

> **Estado:** ✅ Fase 1 implementada (`supabase/migrations/20260607000000_tipo_documento_catalogo.sql`, **pendiente de aplicar a la BD**) · ✅ Fase 2 implementada (`src/lib/tipo-documento.ts`, tipo `TipoDocumento` en `database.ts`, servicio `getTipoDocumento`, endpoint `GET /api/tipo-documento`, y literales 1–6 reemplazados por `TipoDoc.*` en todo `src/`) · ✅ Fase 3 (TS) implementada: tabla de flags + helpers (`esEgreso`, `esAbono`, `afectaCaja`, `afectaKardex`, `generaDeuda`, `signoTipoDoc`) en `lib/tipo-documento.ts`; condiciones multi-tipo migradas a flags (split ingresos/gastos en `page.tsx`, `isGasto` en list-item y detalle, routing de borrado `esAbono` en venta-detalle). Los chequeos de bucket de un solo tipo (`totalAbono`=ABONO, `totalEfectivo`=VENTA|SALDO_FAVOR, `ventasOnly`=VENTA) se dejan como constantes a propósito (no mapean limpio a un flag). **Lado SQL deferido** (RPCs/vistas financieras): migración aún no aplicada y sin tests → fuera de alcance por ahora.

> ⚠️ La tabla de flags en `lib/tipo-documento.ts` es un **espejo** de la semilla de la BD; mantener ambas en sync.

## 1. Situación actual

`Documento."IdTipoDocumento"` es un `bigint` **sin FK ni catálogo**. Los 6
valores posibles están como "números mágicos" repartidos por todo el código:

| Id | Tipo | Semántica |
|----|------|-----------|
| 1 | Venta | `bCredito=true` + `Saldo>0` ⇒ deuda. Ingreso. Afecta caja (si contado) y kardex. |
| 2 | Abono | Pago a una deuda; el item referencia la venta → trigger baja su `Saldo`. Ingreso. Afecta caja. |
| 3 | Gasto | Egreso. Afecta caja. |
| 4 | Saldo a favor | Captura de anticipo/crédito del cliente; `Saldo` = crédito disponible. Ingreso (anticipo). |
| 5 | Ajuste/Baja | Ajuste de inventario / pérdida — kardex. No toca caja. |
| 6 | Abono con saldo a favor | Consume crédito para pagar deuda; sin efectivo, **no** es ingreso. |

### Dónde está cableado (acoplamiento)

**Frontend / servicios (TS)** — ~22 archivos. Ejemplos:
- `src/app/page.tsx` — totales del balance: `IdTipoDocumento !== 3`, `=== 1`, `=== 2`, `=== 4`…
- `src/app/venta-detalle/[id]/page.tsx` — `=== 2 || === 6`, `=== 3`, `=== 4`…
- `src/components/ventas/venta-list-item.tsx` — `=== 3`, `=== 4`, `=== 6`.
- `src/app/api/{gastos,ajustes,saldo-favor,ventas,perdidas}/route.ts` — insertan `IdTipoDocumento: 3/5/4/1`.
- `src/hooks/use-pos-transaction.ts` — única constante con nombre: `TIPO_DOCUMENTO_VENTA = 1` (las demás son literales).
- `src/services/documento-service.ts` — `=== 4`, `.eq("IdTipoDocumento", 4)`, default `?? 1`.

**Base de datos (SQL)** — ~15 objetos (funciones RPC, vistas, triggers):
- `migration-caja-arqueo.sql` — `=1 venta`, `=2 abono`, `=3 gasto`.
- `registrar_abono` / `modificar_abono` — `=2`.
- `aplicar_saldo_favor`, `20260606170000_fecha_hora_orden_fifo` — `=4`.
- `multi_sucursal_fase3b_stock` — `=1` (stock).
- Varias vistas de deuda exponen la columna.

> **Conclusión de acoplamiento:** los IDs **1–6 deben permanecer idénticos**.
> Una tabla de catálogo normaliza la integridad y el display, pero **no** se
> pueden renumerar sin reescribir todo el SQL y TS.

## 2. ¿Qué problema resuelve una tabla?

Dos niveles de valor, independientes:

1. **Catálogo / integridad (bajo esfuerzo):** FK real, nombre legible en UI
   (hoy no hay forma de mostrar "Abono" sin un `switch` en el front), evita
   insertar tipos inexistentes.
2. **Centralizar el comportamiento (alto valor):** hoy cada pantalla
   re-deduce "¿es ingreso?", "¿afecta caja?", "¿afecta kardex?" con `=== n`
   dispersos y frágiles. Si la tabla lleva **flags de comportamiento**, esa
   lógica se lee del catálogo en vez de repetir condiciones.

## 3. Diseño propuesto

Sigue el patrón de `MetodoPago` (tabla de referencia **global**, sin `IdTenant`:
estos tipos son semántica del sistema, no configurables por inquilino) y la
**convención de auditoría del proyecto**: toda tabla mutable lleva los 5 campos
base `id`, `FechaCreacion`, `IdUsuarioCreacion`, `FechaModificacion`,
`IdUsuarioModificacion`, con FKs a `SistemaUsuario(id)` (ver
`20260603000000_auditoria_columnas.sql` y `lib/audit.ts`).

```sql
CREATE TABLE public."TipoDocumento" (
    -- === Campos base (convención de auditoría) ===
    id            bigint PRIMARY KEY,            -- IDs fijos 1..6 (NO identity al sembrar)
    "FechaCreacion"          timestamptz DEFAULT now() NOT NULL,
    "IdUsuarioCreacion"      bigint,
    "FechaModificacion"      timestamptz,
    "IdUsuarioModificacion"  bigint,
    -- === Catálogo ===
    "Nombre"        varchar NOT NULL,            -- "Venta", "Abono", ...
    "Codigo"        varchar NOT NULL,            -- slug estable: VENTA, ABONO, GASTO...
    -- === Flags de comportamiento (el verdadero valor) ===
    "bIngreso"      boolean DEFAULT false,       -- cuenta como ingreso del balance
    "bEgreso"       boolean DEFAULT false,       -- cuenta como egreso (gasto)
    "bAfectaCaja"   boolean DEFAULT false,       -- mueve efectivo en caja
    "bAfectaKardex" boolean DEFAULT false,       -- mueve stock (venta, ajuste)
    "bGeneraDeuda"  boolean DEFAULT false,       -- puede dejar Saldo pendiente
    "bEsAbono"      boolean DEFAULT false,       -- pago que reduce Saldo de otra venta
    "Signo"         smallint DEFAULT 0,          -- +1 ingreso / -1 egreso / 0 neutro
    "Orden"         smallint DEFAULT 0,
    "Estado"        smallint DEFAULT 1
);

-- FKs de auditoría a SistemaUsuario (mismo patrón que el resto de tablas)
ALTER TABLE public."TipoDocumento"
  ADD CONSTRAINT "FK_TipoDocumento_UsuarioCreacion"
    FOREIGN KEY ("IdUsuarioCreacion")     REFERENCES public."SistemaUsuario"(id),
  ADD CONSTRAINT "FK_TipoDocumento_UsuarioModificacion"
    FOREIGN KEY ("IdUsuarioModificacion") REFERENCES public."SistemaUsuario"(id);
```

> Los campos base se aplican a **todas** las tablas mutables. En `TipoDocumento`
> el catálogo es casi estático (se siembra una vez), pero igual lleva los 5
> campos por consistencia; al sembrar, `IdUsuarioCreacion` puede quedar `NULL`
> (semilla del sistema) y `auditUpdate` lo poblaría solo si algún día se edita
> desde la app.

### Semilla (IDs fijos)

| id | Codigo | Nombre | bIngreso | bEgreso | bAfectaCaja | bAfectaKardex | bGeneraDeuda | bEsAbono | Signo |
|----|--------|--------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| 1 | VENTA | Venta | ✓ | | ✓¹ | ✓ | ✓ | | +1 |
| 2 | ABONO | Abono | ✓ | | ✓ | | | ✓ | +1 |
| 3 | GASTO | Gasto | | ✓ | ✓ | | | | −1 |
| 4 | SALDO_FAVOR | Saldo a favor | ✓ | | ✓ | | | | +1 |
| 5 | AJUSTE | Ajuste/Baja | | | | ✓ | | | 0 |
| 6 | ABONO_FAVOR | Abono con saldo a favor | | | | | | ✓ | 0 |

¹ Venta afecta caja solo si es de contado (`bCredito=false`). Ese matiz queda
en la lógica de caja, no en el flag.

### FK en `Documento`

```sql
ALTER TABLE public."Documento"
  ADD CONSTRAINT "Documento_IdTipoDocumento_fkey"
  FOREIGN KEY ("IdTipoDocumento") REFERENCES public."TipoDocumento"(id)
  NOT VALID;                       -- crear sin bloquear; validar aparte
ALTER TABLE public."Documento" VALIDATE CONSTRAINT "Documento_IdTipoDocumento_fkey";
```

> ⚠️ Al sembrar con IDs explícitos 1..6, **no** usar `GENERATED ... IDENTITY`
> sembrando a la vez; si se usa identity, hacer `setval` para que el próximo id
> empiece en 7. Como el catálogo es cerrado, lo más simple es PK manual sin
> secuencia.

## 4. Capa TS (necesaria aunque exista la tabla)

Crear `src/lib/tipo-documento.ts` con el enum/constantes y, opcionalmente, el
tipo + helpers:

```ts
export const TipoDoc = {
  VENTA: 1, ABONO: 2, GASTO: 3,
  SALDO_FAVOR: 4, AJUSTE: 5, ABONO_FAVOR: 6,
} as const;
```

Y reemplazar los literales (`=== 3`, `IdTipoDocumento: 1`, etc.) por estas
constantes. Aunque exista la tabla en BD, el front necesita nombres simbólicos.

Tipo en `src/types/database.ts` — extiende `BaseEnty`, que ya aporta los campos
base de auditoría (`id`, `FechaCreacion`, `IdUsuarioCreacion`,
`FechaModificacion`, `IdUsuarioModificacion`):
```ts
export interface TipoDocumento extends BaseEnty {
  Nombre: string; Codigo: string;
  bIngreso: boolean; bEgreso: boolean; bAfectaCaja: boolean;
  bAfectaKardex: boolean; bGeneraDeuda: boolean; bEsAbono: boolean;
  Signo: number;
}
```

Endpoint read-only `GET /api/tipo-documento` (espejo de `/api/metodo-pago`) y,
si se quiere mostrar el nombre, agregar `TipoDocumento(Nombre)` al `select` de
`documento-service.getVentas` (junto a `MetodoPago(Nombre)`).

## 5. Plan por fases (incremental, sin romper)

- **Fase 1 — BD catálogo.** Crear tabla + semilla 1..6 + FK `NOT VALID`→validar.
  No cambia comportamiento. Migración nueva `supabase/migrations/`.
- **Fase 2 — TS constantes.** `lib/tipo-documento.ts`, tipo en `database.ts`,
  endpoint read-only. Reemplazar literales por constantes (sin cambiar lógica).
- **Fase 3 (opcional) — Lógica por flags.** Migrar condiciones dispersas
  (`!== 3`, `=== 1 || === 4`, etc.) a leer flags (`bIngreso`, `bAfectaCaja`…),
  tanto en TS como, donde aplique, en vistas/RPC. Mayor valor, mayor riesgo →
  hacerlo aparte y con pruebas manuales del balance.

## 6. Riesgos y notas

- **IDs inmutables:** 1..6 ya viven en RPCs/vistas/triggers; renumerar = reescritura masiva. La tabla los formaliza, no los cambia.
- **Global vs tenant:** mantener global (como `MetodoPago`). Si en el futuro un inquilino necesitara tipos propios, se añadiría `IdTenant nullable` (null = global), pero hoy no se requiere.
- **No es bloqueante:** Fase 1 y 2 son seguras y de bajo riesgo; Fase 3 es la que toca lógica financiera.
- **Sin tests automatizados** en el repo → validar manualmente balance/caja/deudas tras Fase 3.

## 7. Recomendación

Hacer **Fase 1 + Fase 2** (catálogo + constantes + flags poblados): ganamos
integridad, nombre legible y una única fuente de verdad de la semántica, con
riesgo mínimo. Dejar **Fase 3** (refactor de lógica a flags) como mejora
posterior priorizada, porque toca cálculos de dinero.
