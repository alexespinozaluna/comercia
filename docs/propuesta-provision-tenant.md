# Propuesta: SUPERADMIN + provisión de Tenant (onboarding interno)

**Fecha:** 2026-06-13
**Estado:** propuesta / pendiente de aprobación para implementar

## Situación actual

`SistemaTenant` **no se crea por código**. El único tenant existe por un seed
manual en `supabase/script/migration-tenant.sql` (`'default'` → id 1), y todas
las columnas `IdTenant` tienen `DEFAULT 1`. `/api/auth/` solo expone `login`,
`logout`, `me`, `refresh` — no hay registro. Alta de tenant = inserts manuales.

## Decisión: un rol SUPERADMIN interno (no público)

La creación de tenants la hace un **SUPERADMIN** (operador del sistema), no un
registro público. Características:

- **SUPERADMIN NO está en `ROLES_VALIDOS`** (`src/types/usuario.ts`). Eso es
  intencional y de seguridad: el endpoint `/api/usuarios` valida contra esa
  lista, así que **un ADMIN de tenant NO puede crear/escalar a SUPERADMIN**.
- El SUPERADMIN vive en un **tenant de sistema** dedicado (`Codigo='system'`),
  aislado de los tenants reales (no aparece en la gestión de usuarios de ningún
  tenant). No opera el POS.
- **Bootstrap del primer SUPERADMIN**: por migración SQL (chicken-and-egg: no se
  puede crear vía endpoint protegido sin un superadmin previo). El `PasswordHash`
  se genera con bcrypt fuera de SQL (comando `node`) y se pega en la migración —
  sin contraseña por defecto.

## Diseño

### 1. RPC transaccional `provisionar_tenant`
Crea atómicamente lo mínimo para que el tenant opere:

| # | Entidad | Detalle |
|---|---------|---------|
| 1 | `SistemaTenant` | `Codigo` único + `Nombre`. |
| 2 | `SistemaUsuario` ADMIN | del tenant nuevo; `PasswordHash` **bcrypt generado en el backend** (`hashPassword`), nunca en SQL. |
| 3 | `Negocio` (sucursal principal) | `Locale`/`Decimales`/`SimboloMoneda`. |
| 4 | `MetodoPago` por defecto | Efectivo (`bEfectivo=true`), Tarjeta, Transferencia, **Deuda (`bDeuda=true`)**. |

> **Cliente común NO se crea**: hoy está cableado a `DEFAULT_CLIENT_ID = 0`
> (artefacto single-tenant) y es solo un fallback de conveniencia — sin él, las
> ventas se guardan con `IdCliente` null sin romperse. Hacerlo per-tenant es un
> refactor aparte (`Negocio.IdClienteComun` o flag `bComun`), fuera de alcance.

Firma sugerida (hash y validaciones resueltos en el backend):
```
provisionar_tenant(
  p_codigo text, p_nombre text,
  p_admin_codigo text, p_admin_nombre text, p_admin_password_hash text,
  p_negocio_nombre text, p_locale text, p_decimales int, p_simbolo text
) RETURNS bigint   -- id del tenant creado
```

### 2. Capa de aplicación
- `tenant-service.ts`: `provisionar(input)` — hashea el password con
  `hashPassword` y llama a la RPC.
- `POST /api/admin/tenants`: `requireRole(user, ['SUPERADMIN'])`, valida
  (`Codigo` único, locale/decimales válidos), llama al service. Maneja `23505`
  (código duplicado) con mensaje claro.

### 3. UI
- `/superadmin` (solo SUPERADMIN): formulario para crear tenant (datos del
  tenant + admin inicial + sucursal/formato). Lista de tenants existentes.
- Guard de ruta + entrada de navegación visible solo para SUPERADMIN.
- **Routing**: al loguear un SUPERADMIN, redirigir a `/superadmin` (no al POS),
  ya que no tiene negocio/operación.

### 4. Endurecer multitenancy (fase 3d, ya pendiente)
- Quitar `DEFAULT 1` de `IdTenant` una vez exista la provisión, para que un
  olvido **falle** en vez de contaminar el tenant 1.

## Plan de ejecución
1. **Migración** `provisionar_tenant` (RPC) + bootstrap del tenant de sistema y
   el SUPERADMIN (hash por comando `node`, placeholder en la migración).
2. **Backend**: rol SUPERADMIN (constante/guards), `tenant-service.provisionar`,
   ruta `POST /api/admin/tenants` + `GET` (listar tenants).
3. **UI**: página `/superadmin` (form + lista), guard, nav, redirect post-login.
4. (Después) Refactor cliente común per-tenant; fase 3d (quitar `DEFAULT 1`).

## Riesgos
- **Seguridad**: SUPERADMIN nunca asignable vía `/api/usuarios`; ruta de
  provisión estrictamente `requireRole(['SUPERADMIN'])`; bootstrap sin password
  por defecto.
- Cross-tenant: el SUPERADMIN no debe filtrarse en lecturas tenant-scoped
  (vive en el tenant de sistema; los services con guard de tenant lo excluyen).
