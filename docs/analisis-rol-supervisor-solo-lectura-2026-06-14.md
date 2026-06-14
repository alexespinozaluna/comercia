# Análisis: rol SUPERVISOR de solo lectura

Fecha: 2026-06-14
Objetivo: el SUPERVISOR ve **todas las opciones del ADMIN** pero **no puede crear,
editar ni eliminar** — solo consulta.

> **Estado (2026-06-14):** Decisiones tomadas → observador puro; SÍ puede cambiar
> de sucursal para supervisar. **Implementado:** backend (chokepoint en `withAuth`
> + `ROLES_SOLO_LECTURA` + `allowReadOnly` en sesiones y cambio de sucursal) y
> visibilidad (helpers `esSoloLectura`/`puedeGestionar`, menú de usuario,
> selector de sucursal, lista de usuarios read-only). Tests de read-only en
> `api-handler.test.ts`.
>
> **Ocultado de controles de escritura (HECHO):** home (Nueva venta/Gasto),
> saldo-favor (crear/editar/eliminar), cliente (Nuevo), producto (Nuevo/toggle/
> card), caja (form abrir/cerrar), venta-detalle (editar/eliminar/abono),
> venta-eliminadas (restaurar), deuda y deuda-detalle (Abonar), producto/ajustes
> (Baja/Inventario), configuracion (Guardar) y los formularios cliente/datos,
> producto/datos, venta-gasto, venta-abono (botón Guardar/Confirmar). Patrón:
> `esSoloLectura(authUser?.rol)`.

## Punto de partida (estado actual)

`SUPERVISOR` ya es un rol válido (`ROLES_VALIDOS`) y hoy tiene **permisos de
escritura completos**: está incluido en los 5 grupos de `PERMISOS`
(`ADMINISTRACION`, `VENTAS_Y_CATALOGO`, `COBRANZA`, `CAJA_Y_GASTOS`,
`CUALQUIER_OPERADOR`). Es decir, hoy un SUPERVISOR puede hacer las mismas
mutaciones que un ADMIN. **No hay que crear el rol; hay que restringirlo.**

Observaciones:
- **Lecturas (GET):** ya están abiertas a SUPERVISOR (los GET son auth-only o
  exigen `ADMINISTRACION`, que lo incluye). → Supervisor ya puede *ver* todo.
- **Nav lateral** (`nav-menu.tsx`): SUPERVISOR ya tiene visibles todas las
  secciones (incluidas Auditoría, Ajustes, Configuración, Papelera, Reporte).
- **Menú de usuario** (`app-shell.tsx`): Configuración / Usuarios / Auditoría se
  muestran solo si `rol === "ADMIN"` → ahí Supervisor NO las ve (inconsistencia).
- **Usuarios** (`/configuracion/usuarios` y API): ADMIN exacto en back y front.

## Diseño propuesto

### 1. Backend — bloqueo de mutaciones (seguridad, imprescindible)

El backend es la única barrera real. Como los grupos de `PERMISOS` mezclan
lectura y escritura (p. ej. `ADMINISTRACION` cubre el GET de auditoría **y** el
DELETE de productos), **no se puede** quitar SUPERVISOR de los grupos sin perder
sus lecturas. La solución limpia es un **chokepoint por método HTTP en `withAuth`**:

```ts
// lib/permisos.ts
export const ROLES_SOLO_LECTURA: readonly string[] = ["SUPERVISOR"];

// lib/api-handler.ts (dentro del wrapper, tras resolver user)
const MUTACIONES = new Set(["POST", "PUT", "PATCH", "DELETE"]);
if (
  MUTACIONES.has(req.method) &&
  ROLES_SOLO_LECTURA.includes(user.rol) &&
  !options.allowReadOnly
) {
  return NextResponse.json({ error: "Tu rol es de solo lectura" }, { status: 403 });
}
```

- SUPERVISOR **conserva** su pertenencia a los grupos (para las lecturas) pero
  queda bloqueado en cualquier POST/PUT/DELETE de negocio.
- `allowReadOnly?: boolean` en las opciones de `withAuth` para las **excepciones
  de autoservicio** (no son datos de negocio):
  - `auth/sesiones` DELETE — cada quien gestiona sus propias sesiones.
  - (a decidir) `sesion/negocio` POST — cambio de sucursal activa; hoy es
    ADMIN-only, así que no afecta a SUPERVISOR salvo que se le habilite.
- Ventaja: **un solo lugar**, imposible olvidar una ruta. Defensa en profundidad:
  aunque el front deje un botón, el back responde 403.

Rutas de negocio que quedan bloqueadas para SUPERVISOR (todas las mutaciones):
ventas, abonos, gastos, saldo-favor, productos, categorías, clientes, ajustes,
caja apertura/cierre, negocio (config). Usuarios y tenants ya eran ADMIN/SUPERADMIN.

### 2. Frontend — visibilidad (ver lo mismo que el ADMIN)

Introducir helpers de rol (en `lib/permisos.ts`, reutilizables):

```ts
export const esSoloLectura = (rol?: string) => !!rol && ROLES_SOLO_LECTURA.includes(rol);
export const puedeGestionar = (rol?: string) => rol === "ADMIN" || rol === "SUPERVISOR";
export const puedeEditar = (rol?: string) => !!rol && !esSoloLectura(rol) && rol !== "SUPERADMIN";
```

- `app-shell.tsx`: cambiar el gate de Configuración / Usuarios / Auditoría de
  `isAdmin` a `puedeGestionar(rol)` para que SUPERVISOR las vea.
- `nav-menu.tsx`: ya las muestra; sin cambios.
- Páginas con guard ADMIN-exacto que deben admitir SUPERVISOR en **lectura**:
  `configuracion`, `configuracion/usuarios` (+`[id]`). Hoy redirigen si
  `rol !== "ADMIN"`; pasar a `puedeGestionar` para entrar, y dentro ocultar los
  controles de escritura (ver punto 3).

### 3. Frontend — ocultar/deshabilitar crear-editar-eliminar (UX)

Gatear con `esSoloLectura(rol)` los controles de escritura. Superficie (≈15
páginas): botones "Nuevo/Crear", "Editar", "Eliminar/Desactivar", "Guardar",
toggles (p. ej. `bActivoVenta` en productos), abrir/cerrar caja, registrar
abono/venta/gasto, aplicar saldo a favor, compartir/revocar link público.

Patrón: un solo helper `esSoloLectura(authUser?.rol)` y `disabled`/no-render. No
es crítico para la integridad (el back ya bloquea), pero sí para no mostrarle al
Supervisor acciones que fallarían. Se puede hacer **incremental**.

## Decisiones abiertas (afectan el alcance)

1. **Acciones operativas que también son mutación**: ¿el Supervisor es un
   observador puro (no abre/cierra caja, no registra abonos/ventas/gastos, no
   comparte links) o se le permite alguna? Recomendado: **observador puro**
   (coincide con "solo vista").
2. **Cambio de sucursal**: ¿puede cambiar de sucursal activa para ver otras?
   Hoy es ADMIN-only. Recomendado: dejarlo ADMIN-only salvo que se necesite
   supervisión multi-sucursal.
3. **Página de Usuarios**: ¿la ve en solo-lectura? El pedido ("todas las
   opciones del admin") sugiere que sí.

## Esfuerzo / riesgo

| Parte | Esfuerzo | Riesgo | Notas |
|---|---|---|---|
| Back: chokepoint en `withAuth` + constante + 1 excepción | Bajo | Bajo | Imprescindible; 1-2 archivos |
| Front: helpers + visibilidad (app-shell, guards usuarios/config) | Bajo-medio | Bajo | |
| Front: ocultar controles de escritura (~15 páginas) | Medio | Bajo | Incremental; el back ya protege |
| Tests: chokepoint read-only en `withAuth` (GET ok, POST/PUT/DELETE 403, excepción) | Bajo | — | Extiende `api-handler.test.ts` |

## Recomendación de implementación (orden)

1. Back: `ROLES_SOLO_LECTURA` + bloqueo por método en `withAuth` + `allowReadOnly`
   en `auth/sesiones` DELETE. Tests.
2. Front: helpers en `permisos.ts` + visibilidad (app-shell + guards de
   config/usuarios a `puedeGestionar`, con escritura solo para ADMIN).
3. Front: ocultar controles de escritura por página (incremental).
