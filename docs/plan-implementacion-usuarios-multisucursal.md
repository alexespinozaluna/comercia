# Plan de implementación — CRUD de usuarios + asignación de sucursal

**Fecha:** 2026-06-02
**Proyecto:** Comercia Web (Next.js 16 + Supabase)
**Base:** [Auditoría de usuarios y multi-sucursal](auditoria-usuarios-multisucursal.md)
**Objetivo:** habilitar gestión de usuarios solo para ADMIN, con sucursal asignada por usuario que aplica al login y bloquea el selector de sucursales para no-ADMIN.

---

## Fase 0 — Decisiones previas

Defaults asumidos (todos negociables):

| Decisión | Default asumido |
|---|---|
| `IdNegocio` en `SistemaUsuario` | Nullable en DB; required para no-ADMIN en la API |
| ADMIN con `IdNegocio = NULL` | Sigue comportamiento actual: ve todas las sucursales hasta usar el selector |
| Delete | Soft (`Estado = 0`); no hay hard delete |
| Anti-lockout | No se puede desactivar / quitar rol al último ADMIN activo del tenant |
| Sesión activa al editar `IdNegocio` | No se revoca token; aplica al próximo login |
| Unicidad de `Codigo` | Unique `(IdTenant, Codigo)` + filtrar `findByCodigo` por tenant — incluido en el paquete |

---

## Fase 1 — Base de datos y unicidad

**Archivo / lugar:** Supabase SQL editor o `supabase/migrations/NNNN_user_negocio.sql`.

```sql
-- 1.1 Agregar IdNegocio nullable
ALTER TABLE "SistemaUsuario"
  ADD COLUMN "IdNegocio" bigint REFERENCES "Negocio"(id);

-- 1.2 Backfill: cada usuario hereda la sucursal default de su tenant (excepto ADMIN)
UPDATE "SistemaUsuario" u
SET "IdNegocio" = (
  SELECT id FROM "Negocio"
  WHERE "IdTenant" = u."IdTenant" AND "Estado" = 1
  ORDER BY id ASC LIMIT 1
)
WHERE "IdNegocio" IS NULL AND "Rol" <> 'ADMIN';

-- 1.3 Unicidad de Codigo por tenant (ver Fase 5 si se elige UNIQUE global)
ALTER TABLE "SistemaUsuario"
  ADD CONSTRAINT "SistemaUsuario_tenant_codigo_unique"
  UNIQUE ("IdTenant", "Codigo");
```

**Gate:** verificar en Studio (a) la columna existe, (b) todos los usuarios no-ADMIN tienen `IdNegocio`, (c) no hay duplicados que rompan el UNIQUE.

---

## Fase 2 — Tipos y servicio

### 2.1 — `src/types/database.ts`
Agregar `IdNegocio: number | null` al interface `SistemaUsuario`.

### 2.2 — `src/services/usuario-service.ts`
- Agregar `IdNegocio` a los `select(...)` de `findByCodigo` y `getById`.
- Cambiar `findByCodigo` para filtrar por tenant (ver Fase 5).
- Agregar:
  - `listByTenant(tenant: number): Promise<UsuarioSinPassword[]>` — orden por `Nombre`, sin password
  - `create(tenant, data: { Codigo, Nombre, Password, Rol, IdNegocio }): Promise<UsuarioSinPassword>`
    - Hashea password con `bcryptjs`
    - Si `Rol !== "ADMIN"`, validar `IdNegocio != null` y que pertenezca al tenant
    - Mapear error de UNIQUE → mensaje legible
  - `update(id, tenant, data: Partial<{ Nombre, Password, Rol, IdNegocio, Estado }>): Promise<boolean>`
    - Password opcional (solo re-hashear si viene)
    - Validar mismo tenant
    - Anti-lockout antes de cambiar `Rol` o `Estado`
  - `softDelete(id, tenant): Promise<boolean>` — `Estado = 0` + chequeo anti-lockout
  - `countActiveAdmins(tenant, excludeId?): Promise<number>` — helper anti-lockout

**Gate:** lint OK; servicios escritos pero no consumidos todavía.

---

## Fase 3 — Endpoints API

| Archivo | Métodos | Guard |
|---|---|---|
| `src/app/api/usuarios/route.ts` | `GET`, `POST` | `requireRole(["ADMIN"])` |
| `src/app/api/usuarios/[id]/route.ts` | `GET`, `PUT`, `DELETE` | `requireRole(["ADMIN"])` |

**Reglas comunes:**
- `getCurrentUserFromRequest` + `requireRole(user, ["ADMIN"])`.
- `POST` / `PUT`: validar `IdNegocio` (required si `Rol !== "ADMIN"`).
- `PUT`: bloquear que ADMIN se cambie su propio `Rol`/`Estado`.
- `DELETE`: soft (`Estado = 0`). Anti-lockout.
- Respuestas `{ data }` éxito / `{ error }` con status apropiado.

**Gate:** `curl` o cliente HTTP: GET lista, POST crea, PUT modifica, DELETE desactiva. Login como CAJERO → 403.

---

## Fase 4 — Cambios en flujo existente

### 4.1 — `src/app/api/auth/login/route.ts`

```ts
const idNegocio = user.IdNegocio
  ?? (await negocioService.getDefaultForTenant(user.IdTenant))?.id
  ?? null;
```

### 4.2 — `src/components/layout/negocio-selector.tsx` (línea 38)

```ts
if (!authUser || authUser.rol !== "ADMIN" || negocios.length <= 1) return null;
```

### 4.3 — `src/app/api/sesion/negocio/route.ts`

```ts
const user = await getCurrentUserFromRequest(req);
if (!user) return 401;
requireRole(user, ["ADMIN"]);
```

**Gate:** login como CAJERO/VENDEDOR — dropdown de sucursal **no aparece**; POST `/api/sesion/negocio` → 403.

---

## Fase 5 — ⚠️ Decisión bloqueante: login multi-tenant

Login actual recibe solo `{ codigo, password }`. Con UNIQUE `(IdTenant, Codigo)`, dos tenants pueden tener el mismo `Codigo` y `findByCodigo` no sabe a cuál pertenece.

| Opción | Cómo | Costo |
|---|---|---|
| **A. Codigo único global** | UNIQUE `("Codigo")` global. | Mínimo. Impide mismo Codigo en distintos tenants. |
| **B. Login pide tenant** | Campo "Empresa" en el form. | UX peor; afecta usuarios existentes. |
| **C. Subdominio = tenant** | Resolver tenant del host. | Cambio de infra. |

**Recomendación**: A para esta fase. Si más adelante hace falta colisión por tenant, migrar a B o C en otro proyecto.

→ Si se elige A, en Fase 1 reemplazar:
```sql
ALTER TABLE "SistemaUsuario" ADD CONSTRAINT "SistemaUsuario_codigo_unique" UNIQUE ("Codigo");
```
Y en Fase 2, `findByCodigo` se queda como está.

**Resolver antes de Fase 1** o quedar bloqueado en Fase 2.

---

## Fase 6 — UI de administración

### 6.1 — `src/app/configuracion/usuarios/page.tsx`
- Lista de usuarios del tenant.
- Guard: si `authUser.rol !== "ADMIN"`, redirect a `/`.
- Columnas: Nombre, Codigo, Rol, Sucursal, Estado, Acciones (editar / desactivar).
- Botón "Nuevo usuario" → `/configuracion/usuarios/nuevo`.
- Estilo consistente con `/configuracion` y `/cliente`.

### 6.2 — `src/app/configuracion/usuarios/[id]/page.tsx`
- Creación (`[id] === "nuevo"`) y edición.
- Campos:
  - **Codigo** — disabled en edición
  - **Nombre**
  - **Password** — vacío en edición = no cambiar
  - **Rol** — Select: ADMIN, CAJERO, VENDEDOR, SUPERVISOR, COBRANZA
  - **Sucursal** — Select con `/api/negocio`. Required si `Rol !== "ADMIN"`; disabled/"Todas" si ADMIN
  - **Estado** — toggle (solo edición)
- Mismo guard de rol.
- Guardar → POST/PUT; toast; redirect a `/configuracion/usuarios`.

### 6.3 — Acceso desde el menú
En `src/components/layout/app-shell.tsx` (UserMenu, ~línea 141), agregar item "Usuarios" si `isAdmin`.

**Gate UX:**
1. Login ADMIN → crear CAJERO con sucursal X → logout.
2. Login CAJERO → entra a sucursal X, **sin** dropdown.
3. Login ADMIN → editar CAJERO, cambiar sucursal → próximo login del CAJERO entra a la nueva.

---

## Fase 7 — QA manual

| Caso | Esperado |
|---|---|
| ADMIN crea CAJERO sin IdNegocio | 400 "IdNegocio requerido para rol CAJERO" |
| ADMIN crea con IdNegocio de otro tenant | 400 "Negocio no válido" |
| CAJERO llama `POST /api/usuarios` | 403 |
| CAJERO llama `POST /api/sesion/negocio` | 403 |
| CAJERO ve el header | Sin dropdown de sucursal |
| ADMIN se intenta desactivar siendo el único ADMIN | 400 anti-lockout |
| Crear dos usuarios con mismo Codigo | 400/409 |
| Login de usuario con `IdNegocio` asignado | `authUser.idNegocio` = asignado, no default del tenant |

---

## Orden recomendado de PRs

1. **PR-1 (Fase 1 + 5):** migración SQL + decisión de UNIQUE. Sin código TS.
2. **PR-2 (Fase 2 + 3):** tipos, servicio, endpoints. Sin cambios visibles aún.
3. **PR-3 (Fase 4):** login + selector + sesion guard. Cambia comportamiento.
4. **PR-4 (Fase 6):** UI completa.

Cada PR es deployable de forma independiente.
