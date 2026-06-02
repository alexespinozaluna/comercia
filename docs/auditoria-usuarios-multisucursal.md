# Auditoría — gestión de usuarios y asignación de sucursal

**Fecha:** 2026-06-02
**Proyecto:** Comercia Web (Next.js 16 + Supabase)
**Alcance:** estado actual de creación/modificación de usuarios y su relación con `Negocio` (sucursal). Propuesta para que solo ADMIN gestione usuarios y para que cada usuario tenga su sucursal asignada por defecto.

---

## Estado actual

### 1. No existe ningún CRUD de usuarios en la aplicación

- ❌ No hay endpoints en `/api/usuarios/*`
- ❌ No hay página en `/configuracion/usuarios` ni en ningún lado
- ❌ `usuario-service.ts` solo expone: `findByCodigo`, `validateLogin`, `getById` (todo para auth, ninguno para create/update/delete)
- 👉 **La única forma de crear usuarios hoy es escribir directo en Supabase** (Studio o SQL).

### 2. No hay asignación persistida usuario → sucursal

Tabla `SistemaUsuario` (`src/types/database.ts:191-200`):

```ts
export interface SistemaUsuario {
  id: number;
  IdTenant: number;
  Codigo: string;
  Nombre: string;
  PasswordHash: string;
  Rol: string;
  Estado: number;
  FechaCreacion: string;
}
```

❌ **No tiene columna `IdNegocio` ni `IdNegocioDefault`**.

En el login (`src/app/api/auth/login/route.ts:27`):

```ts
const negocio = await negocioService.getDefaultForTenant(user.IdTenant);
const idNegocio = negocio?.id ?? null;
```

→ **A cualquier usuario que hace login se le asigna `getDefaultForTenant`** = el primer negocio activo del tenant (ordenado por `id` ascendente). El usuario no tiene "su" sucursal — siempre arranca en la default.

### 3. El selector de sucursal NO restringe por rol

`src/components/layout/negocio-selector.tsx:37-38`:

```ts
// Sin usuario o con una sola sucursal no hace falta el selector.
if (!authUser || negocios.length <= 1) return null;
```

→ Cualquier rol (`CAJERO`, `VENDEDOR`, `COBRANZA`, `SUPERVISOR`, `ADMIN`) ve el dropdown y puede cambiar.

`src/app/api/sesion/negocio/route.ts:20-26`:

```ts
const negocio = await negocioService.getById(idNegocio, user.idTenant);
if (!negocio) return 404;
if (negocio.Estado !== 1) return 400;
// → emite token nuevo
```

→ El endpoint POST `/api/sesion/negocio` **solo verifica tenant ownership, no rol**. Cualquier usuario autenticado puede cambiar de sucursal vía API directa.

### 4. Roles definidos

`ADMIN`, `CAJERO`, `VENDEDOR`, `SUPERVISOR`, `COBRANZA`. Solo `ADMIN` y `SUPERVISOR` se usan para acciones de elevación (PUT `/api/negocio`, anular ventas, ver historial de caja). **`ADMIN` exclusivo: ningún endpoint lo exige hoy**.

### 5. `/configuracion` ≠ gestión de usuarios

- Solo aparece en el dropdown si `rol === "ADMIN"` (`app-shell.tsx:141`).
- Edita el `Negocio` (nombre/dirección/teléfono/logo). **No tiene nada de usuarios**.

---

## Gaps vs. lo deseado

| Requerimiento | Hoy | Falta |
|---|---|---|
| Solo ADMIN crea usuarios | No existe creación | Endpoint `POST /api/usuarios` con `requireRole(["ADMIN"])` + UI |
| Solo ADMIN modifica usuarios | No existe edición | Endpoint `PUT /api/usuarios/[id]` con `requireRole(["ADMIN"])` + UI |
| Usuario tiene sucursal asignada | Asignación = default del tenant en login | Columna `IdNegocio` en `SistemaUsuario` + usarla en login |
| Sucursal aparece "por defecto" para el usuario | Sí aparece la default del tenant, no la del user | Login debe leer `user.IdNegocio` en vez de `getDefaultForTenant` |
| Solo ADMIN navega entre sucursales | Cualquier rol con >1 sucursal puede | `NegocioSelector` debe ocultarse si `rol !== "ADMIN"`, y `POST /api/sesion/negocio` debe `requireRole(["ADMIN"])` |
| Usuario no-admin tiene sucursal fija | El dropdown está visible | Mismo punto: esconder + endpoint cerrado |

---

## Propuesta de cambios

### A) Base de datos (Supabase)

```sql
ALTER TABLE "SistemaUsuario"
  ADD COLUMN "IdNegocio" bigint REFERENCES "Negocio"(id);

-- Backfill: asignar a cada usuario el primer negocio activo de su tenant
UPDATE "SistemaUsuario" u
SET "IdNegocio" = (
  SELECT id FROM "Negocio"
  WHERE "IdTenant" = u."IdTenant" AND "Estado" = 1
  ORDER BY id ASC LIMIT 1
)
WHERE "IdNegocio" IS NULL;
```

**Decisión a tomar**: ¿`IdNegocio` es nullable (admin sin sucursal fija) o NOT NULL (todos atados a una)? Recomiendo nullable — el ADMIN puede no estar atado y siempre usar el selector; no-admin tiene `IdNegocio` obligatorio (validado en la API, no en DB).

También vale la pena agregar unique `(IdTenant, Codigo)` para evitar colisiones entre tenants en login.

### B) Tipos + servicio

`src/types/database.ts`:

```ts
export interface SistemaUsuario {
  id: number;
  IdTenant: number;
  IdNegocio: number | null;  // ← NEW
  Codigo: string;
  Nombre: string;
  PasswordHash: string;
  Rol: string;
  Estado: number;
  FechaCreacion: string;
}
```

`src/services/usuario-service.ts` — agregar:

```ts
async listByTenant(tenant: number): Promise<UsuarioSinPassword[]>
async create(tenant: number, data: { Codigo; Nombre; Password; Rol; IdNegocio }): Promise<UsuarioSinPassword>
async update(id: number, tenant: number, data: Partial<{ Nombre; Password; Rol; IdNegocio; Estado }>): Promise<boolean>
```

(`create` hashea password con `bcryptjs`, valida que `IdNegocio` pertenezca al tenant, valida que `Codigo` sea único por tenant.)

### C) API routes nuevas

| Ruta | Método | Guard | Notas |
|---|---|---|---|
| `/api/usuarios` | GET | `["ADMIN"]` | Lista usuarios del tenant del admin |
| `/api/usuarios` | POST | `["ADMIN"]` | Crear; requiere `Codigo, Nombre, Password, Rol, IdNegocio` |
| `/api/usuarios/[id]` | GET | `["ADMIN"]` | Detalle (sin PasswordHash); validar mismo tenant |
| `/api/usuarios/[id]` | PUT | `["ADMIN"]` | Editar; password opcional (solo re-hashear si viene) |
| `/api/usuarios/[id]` | DELETE | `["ADMIN"]` | Soft delete (`Estado = 0`) o real; recomendado soft |

### D) Cambios en flujo existente

**`/api/auth/login/route.ts`** — usar `IdNegocio` del usuario:

```ts
// Sucursal: la del usuario si la tiene; si no, default del tenant (fallback ADMIN)
const idNegocio = user.IdNegocio
  ?? (await negocioService.getDefaultForTenant(user.IdTenant))?.id
  ?? null;
```

**`src/components/layout/negocio-selector.tsx`** — restringir a ADMIN:

```ts
// Sin usuario, sin admin, o con una sola sucursal: no mostrar.
if (!authUser || authUser.rol !== "ADMIN" || negocios.length <= 1) return null;
```

**`/api/sesion/negocio/route.ts`** — agregar guard:

```ts
const user = await getCurrentUserFromRequest(req);
if (!user) return 401;
requireRole(user, ["ADMIN"]);  // ← NEW
```

### E) UI nueva

- `src/app/configuracion/usuarios/page.tsx` — lista de usuarios + botón "Nuevo" (ADMIN only, guard en page con redirect).
- `src/app/configuracion/usuarios/[id]/page.tsx` — alta/edición (Codigo no editable en update, Password opcional, dropdown `IdNegocio` con la lista de `/api/negocio`, dropdown `Rol`).
- Item en dropdown del header / menú "Configuración" → "Usuarios".

---

## Riesgos / consideraciones

1. **Sesiones activas**: si cambias `IdNegocio` de un usuario que está logueado, su JWT vigente sigue con el `idNegocio` viejo (8h). Opción: revocar tokens manualmente o aceptar que aplique al próximo login.
2. **ADMIN sin `IdNegocio` y endpoints que filtran por sucursal**: hoy varios endpoints (ventas, caja, productos) filtran por `IdNegocio` del JWT. Si `ADMIN` tiene `null`, pasa `null` y los servicios omiten el filtro (ver `documento-service.ts:84`). Esto significa **ADMIN ve TODAS las sucursales** — confirmar si es lo deseado o si ADMIN debe ver solo la sucursal activa del selector.
3. **Validación de unicidad de `Codigo`**: hoy `findByCodigo` no filtra por tenant — login con el mismo `Codigo` en tenants distintos colisionaría. Aprovechar para agregar el filtro por tenant en `findByCodigo` y unique constraint `(IdTenant, Codigo)` en DB.
4. **Borrado de negocio referenciado por usuarios**: con la FK, no podrás borrar un negocio sin antes reasignar/desactivar usuarios. Considerar `ON DELETE SET NULL` o forzar reasignación.
5. **Auto-modificación**: ¿el ADMIN puede editarse a sí mismo? ¿bajarse el rol? Recomiendo bloquear que un ADMIN se quite su propio rol o se borre (evita lock-out).

---

## Pendiente / próximas decisiones

- Decidir nullable vs NOT NULL para `IdNegocio` en `SistemaUsuario`.
- Decidir comportamiento de ADMIN con `IdNegocio = NULL` respecto al filtrado por sucursal en otros endpoints.
- Definir si DELETE de usuario es soft (`Estado = 0`) o hard.
- Definir política anti-lockout (último ADMIN del tenant no se puede desactivar/borrar).
- Decidir si tras editar `IdNegocio` se revoca el token del usuario afectado.
