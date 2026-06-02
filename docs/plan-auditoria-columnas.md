# Plan — Convención de auditoría en todas las tablas (creador / modificador)

**Fecha:** 2026-06-02
**Proyecto:** Comercia Web (Next.js 16 + Supabase)
**Objetivo:** establecer y aplicar una convención uniforme de columnas de auditoría (`IdUsuarioCreacion`, `FechaCreacion`, `IdUsuarioModificacion`, `FechaModificacion`) en todas las tablas operativas y de catálogo, con poblado automático desde un helper de aplicación.

---

## Convención

| Columna | Tipo | Default | Nullable |
|---|---|---|---|
| `FechaCreacion` | `timestamp with time zone` | `now()` | NO |
| `IdUsuarioCreacion` | `bigint` | — | SÍ (legacy + datos de seed) |
| `FechaModificacion` | `timestamp with time zone` | — | SÍ |
| `IdUsuarioModificacion` | `bigint` | — | SÍ |

- Todas las columnas `IdUsuario*` con FK a `SistemaUsuario(id)`.
- Las columnas se rellenan desde el código (opción A pura), no por triggers.

## Tablas afectadas

### Grupo A — Mutables (4 columnas completas)
Cliente, ClienteDireccion, Producto, Categoria, Negocio, MetodoPago, SistemaTenant, SistemaUsuario, Documento, DocumentoItem, ProductoStock.

### Grupo B — Inmutables (solo INSERT → solo 2 columnas)
ProductoMovimiento, LinkPublico. Reciben `IdUsuarioCreacion` + `FechaCreacion`. Los campos de modificación se omiten (no aplican).

### Grupo C — No tocar
- **Caja**: usa `IdUsuarioApertura` / `IdUsuarioCierre` con semántica propia. Se le agregan **FKs** a `SistemaUsuario(id)` pero **no** los campos genéricos.
- **DocumentoAudit / DocumentoItemAudit**: tablas de auditoría ya cumplen ese rol con `UsuarioAudit` (text) + `FechaAudit`. Sin cambios.

### Renombres
- `ProductoMovimiento.IdUsuario` → `IdUsuarioCreacion` (consistencia). Cambio breaking, aislado a 3 archivos TS + trigger de stock.

---

## Mecánica de poblado (opción A pura)

### Helper `src/lib/audit.ts`

```ts
import type { APIUser } from "./api-auth";
import { nowIso } from "./format";

/** Inyecta IdUsuarioCreacion. FechaCreacion la pone el DEFAULT now() de la columna. */
export function auditCreate<T extends object>(user: APIUser, payload: T) {
  return { ...payload, IdUsuarioCreacion: user.id };
}

/** Inyecta IdUsuarioModificacion + FechaModificacion. */
export function auditUpdate<T extends object>(user: APIUser, patch: T) {
  return {
    ...patch,
    IdUsuarioModificacion: user.id,
    FechaModificacion: nowIso(),
  };
}
```

### `src/lib/format.ts` agrega:

```ts
/** ISO 8601 UTC para columnas TIMESTAMPTZ. Único punto de creación de timestamps en la app. */
export function nowIso(): string {
  return new Date().toISOString();
}
```

### Uso en services — INSERT/UPDATE directos

```ts
await sb.from("Cliente").insert(auditCreate(user, { Nombre, IdTenant }));
await sb.from("Cliente").update(auditUpdate(user, { Nombre })).eq("id", id);
```

### Uso en RPCs (los campos viajan en el JSON)

```ts
const docPayload = isNew ? auditCreate(user, docJson) : auditUpdate(user, docJson);
const itemsToAdd = items.map((it) => auditCreate(user, it));
const itemsToUpdate = toUpdate.map((it) => auditUpdate(user, it));

sb.rpc("guardar_venta_con_items", {
  p_documento: docPayload,
  p_items_to_add: itemsToAdd,
  p_items_to_update: itemsToUpdate,
  // ya NO va p_id_usuario_creacion
});
```

La RPC lee `(p_documento->>'IdUsuarioCreacion')::bigint`, etc.

---

## Fases

### Fase 1 — Migración de columnas + FKs + índices

Archivo: `supabase/migrations/20260603000000_auditoria_columnas.sql`

- Agrega las 4 columnas a Grupo A (`IF NOT EXISTS`).
- Agrega 2 columnas a Grupo B.
- FKs `IdUsuario* → SistemaUsuario(id)` en todas las columnas usuario (incluye `Documento.IdUsuarioCreacion` que ya existía sin FK).
- FKs a `Caja.IdUsuarioApertura` / `IdUsuarioCierre` (Grupo C).
- Índices por cada columna usuario.
- Pre-check de huérfanos al inicio (comentado, para correr aparte).
- Idempotente.

### Fase 2 — Renombre `ProductoMovimiento.IdUsuario` → `IdUsuarioCreacion`

Migración separada (`20260603010000_rename_productomovimiento_idusuario.sql`):
- `ALTER TABLE ... RENAME COLUMN`.
- Idempotente vía `DO $$ ... IF EXISTS column ... END $$`.

TS:
- `src/types/database.ts`: renombrar en interfaz.
- `src/app/api/productos/route.ts`: cambiar `IdUsuario` por `IdUsuarioCreacion`.
- `src/app/api/ajustes/route.ts:189`: idem.
- Trigger `fn_registrar_movimiento_stock` si referencia la columna por nombre.

### Fase 3 — Tipos

`src/types/database.ts`:

```ts
export interface BaseEnty {
  id: number;
  FechaCreacion: string;
  IdUsuarioCreacion: number | null;
  FechaModificacion: string | null;
  IdUsuarioModificacion: number | null;
}
```

Tablas Grupo B (inmutables) NO extienden `BaseEnty` completo, declaran solo las 2 columnas de creación. Reconsiderar la jerarquía: quizá un `CreatableEnty` (solo creación) y `BaseEnty` extiende de él agregando modificación.

```ts
export interface CreatableEnty {
  id: number;
  FechaCreacion: string;
  IdUsuarioCreacion: number | null;
}
export interface BaseEnty extends CreatableEnty {
  FechaModificacion: string | null;
  IdUsuarioModificacion: number | null;
}
```

### Fase 4 — Helper + refactor de services

- Crear `src/lib/audit.ts` y `nowIso()` en `src/lib/format.ts`.
- Refactorizar cada service y cada API route que haga INSERT o UPDATE directo (~15 archivos): aplicar `auditCreate` / `auditUpdate`.

### Fase 5 — Modificar RPCs

RPCs a tocar (migraciones nuevas, idempotentes con `CREATE OR REPLACE`):
- `guardar_venta_con_items` — eliminar `p_id_usuario_creacion`; leer del JSON `p_documento` / items.
- `registrar_abono` — idem.
- `modificar_abono` — idem.
- `validar_total_items` — idem.

**Compatibilidad temporal**: el primer rollout puede aceptar ambos (parámetro opcional + JSON con fallback) si hay deploys parciales; al confirmar que el cliente usa la nueva firma, una migración siguiente elimina el parámetro.

### Fase 6 — Embed PostgREST en lecturas

`select("..., CreadoPor:SistemaUsuario!FK_X_UsuarioCreacion(Nombre), ModificadoPor:SistemaUsuario!FK_X_UsuarioModificacion(Nombre)")` en los services que devuelven detalle (e.g. `getVentaConItem`).

### Fase 7 — UI

- `/venta-detalle/[id]`: agregar fila "Creada por X"; fila Fecha usa `fechaCortaHora(FechaEmision, FechaCreacion)` con regla nueva (mismo día → fecha+hora; distinto → solo fecha).
- `/venta-eliminadas`: mostrar creador en cada fila.
- `/deuda-detalle`: idem.
- Detalle de cliente/producto: opcional, mostrar "Última modificación: fecha por Y" cuando aplique.

### Fase 8 — Helper de fecha

`src/lib/format.ts`: actualizar `fechaCortaHora`:
```ts
export function fechaCortaHora(fecha: Date, fechaHora: Date): string {
  if (fecha.toDateString() === fechaHora.toDateString()) {
    return `${formatDatePart(fechaHora)} | ${formatTimePart(fechaHora)}`;
  }
  return formatDatePart(fecha); // solo fecha, sin hora
}
```

Sin consumidores externos (verificado), riesgo cero.

---

## Riesgos

- **FK falla por huérfanos**: pre-check en la migración como bloque comentado.
- **Tablas grandes** (Documento, DocumentoItem): `ADD COLUMN` con default constante o NULL no reescribe la tabla en Postgres moderno.
- **PostgREST embed con múltiples FKs a la misma tabla**: requiere desambiguar con `!nombre_fk`. Por eso nombramos las FKs explícitamente.
- **Auditoría desde Supabase Studio (UPDATE directo)**: NO se autopopulará. Trade-off aceptado (opción A pura, sin triggers).
- **RPCs**: cambio de firma. Hay que confirmar que ningún consumer externo (extensiones, otras apps) los llame.

---

## Orden de PRs

1. **PR-1**: Fase 1 (migración columnas + FKs) + Fase 3 (tipos). DB cambia, código no rompe (servicios siguen sin tocar las columnas nuevas).
2. **PR-2**: Fase 2 (renombre ProductoMovimiento.IdUsuario).
3. **PR-3**: Fase 4 (helper + refactor services para INSERT/UPDATE directos).
4. **PR-4**: Fase 5 (modificar RPCs) + actualizar callers en services.
5. **PR-5**: Fase 6 + Fase 7 + Fase 8 (lectura, UI, helper de fecha).
