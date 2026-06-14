# Auditoría general: SOLID, DRY, código muerto y optimización

Fecha: 2026-06-13
Alcance: `src/` completo (212 archivos, ~22.5k LOC). ESLint pasa sin warnings.

---

## 1. Archivos huérfanos (código muerto — eliminar)

Verificado: ningún `import` los referencia en todo `src`.

| Archivo | Motivo |
|---|---|
| `src/lib/supabase.ts` | Cliente Supabase de frontend. **0 imports.** El login va por `/api/auth/login`, no usa este cliente. La descripción en `CLAUDE.md` ("anon key for frontend auth login") quedó **desactualizada**. |
| `src/hooks/pos/use-clientes.ts` | Hook POS. 0 imports (se usa `use-cliente-seleccionado` en su lugar). |
| `src/components/shared/card-header-icon.tsx` | 0 imports. |
| `src/components/shared/printer-dialog.tsx` | 0 imports (la impresión vive en `bluetooth-printer` + `printer` del hook). |
| `src/components/ventas/loss-section.tsx` | 0 imports. |
| `src/components/ventas/quick-metric-cards.tsx` | 0 imports. |
| `src/components/ui/avatar.tsx` | shadcn generado, nunca usado. |
| `src/components/ui/calendar.tsx` | shadcn generado, nunca usado (se usa `react-day-picker` vía otra ruta / o nada). |
| `src/components/ui/radio-group.tsx` | shadcn generado, nunca usado. |
| `src/components/ui/skeleton.tsx` | shadcn generado, nunca usado (loading va por `loading-state.tsx`). |

> Nota: borrar los `ui/*` no usados es seguro; si en el futuro se necesitan, `npx shadcn add <comp>` los regenera.

## 2. Exports muertos dentro de archivos vivos

`src/services/supabase-service.ts` — único consumidor es `producto-service.ts`, que solo usa
`add`, `update`, `deleteItem`. Estos exports **no se usan en ningún lado**:

- `getAll<T>`, `getById<T>` (genéricos)
- `cleanJsonId`, `cleanJsonIdArray`
- `SUPABASE_URL`, `REST_URL`

Recomendación: reducir el archivo a las 3 funciones vivas, o mover `add/update/deleteItem`
directo a `producto-service.ts` y eliminar `supabase-service.ts` por completo (el resto de
services ya llaman `getSupabaseServer()` directo — el "base service genérico" portado de C#
quedó como vestigio).

## 3. DRY — Boilerplate repetido en API routes (mayor oportunidad) ✅ HECHO (paso 3)

> Implementado: `src/lib/api-handler.ts` con `withAuth(handler, { roles, exposeErrors })`
> y `ApiError(status, msg)`. Las 40 rutas autenticadas (≈70 handlers) se migraron;
> `requireRole`/`requireAuth` se eliminaron de `api-auth.ts` al quedar muertos.
> Solo quedan fuera las rutas públicas (login/logout/refresh, deudas pública, link
> público, tipo-movimiento). `exposeErrors` preserva las rutas que devolvían el
> mensaje del servicio/RPC como 400.


Las 46 rutas repiten el **mismo bloque** en cada handler:

```ts
const user = await getCurrentUserFromRequest(req);
if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 }); // ×39
// ...
catch (err) {
  const msg = err instanceof Error ? err.message : "Error interno";
  const status = msg === "Forbidden" ? 403 : 400;  // ×10
  console.error("...", err);                         // ×39
  return NextResponse.json({ error: msg }, { status });
}
```

**Propuesta: un wrapper `withAuth` en `src/lib/api-auth.ts`** que centralice auth + roles +
mapeo de errores + logging. Cada handler quedaría así:

```ts
export const GET = withAuth(async (req, { user }) => {
  const data = await categoriaService.getAll(user.idTenant);
  return NextResponse.json({ data });
});

export const POST = withAuth(
  async (req, { user }) => { /* ... */ },
  { roles: PERMISOS.GESTION_CATALOGO },
);
```

El wrapper traduce `"Unauthorized"→401`, `"Forbidden"→403`, valida roles y hace el
`try/catch` + `console.error`. Ahorra ~8-12 líneas por handler (≈ 400-500 LOC) y vuelve
imposible olvidar el check de auth (hoy es copy-paste manual). Esto es **SRP**: la ruta solo
describe la lógica de negocio; auth/errores son responsabilidad del wrapper.

## 4. SOLID — "Magic strings" de roles dispersos ✅ HECHO (paso 2)

> Implementado: `src/lib/permisos.ts` centraliza los grupos por capacidad y las
> 30 llamadas `requireRole(...)` en 22 rutas ahora usan `PERMISOS.*`.


Los arrays de roles están hardcodeados y repetidos por toda la capa de rutas:

```
11×  ["ADMIN", "SUPERVISOR"]
 7×  ["ADMIN", "CAJERO", "COBRANZA", "SUPERVISOR"]
 6×  ["ADMIN", "CAJERO", "VENDEDOR", "SUPERVISOR"]
 4×  ["ADMIN", "CAJERO", "SUPERVISOR"]
 2×  ["ADMIN", "CAJERO", "VENDEDOR", "COBRANZA", "SUPERVISOR"]
```

Si mañana se agrega un rol o cambia un permiso, hay que tocar ~30 archivos sin garantía de
consistencia. Centralizar en constantes semánticas (no por rol, por **capacidad**):

```ts
// src/lib/permisos.ts
export const PERMISOS = {
  SOLO_ADMIN:        ["ADMIN", "SUPERVISOR"],
  GESTION_CATALOGO:  ["ADMIN", "CAJERO", "VENDEDOR", "SUPERVISOR"],
  COBRANZA:          ["ADMIN", "CAJERO", "COBRANZA", "SUPERVISOR"],
  // ...
} as const;
```

## 5. DRY — Patrón fetch/loading/error repetido en el frontend ✅ HECHO (paso 4)

> Implementado: `src/hooks/use-resource.ts` (`useResource(fetcher, deps?)` →
> `{ data, loading, error, reload, setData }`). Migradas 15 páginas: saldo-favor,
> sesiones, venta-eliminadas, deuda, cliente, caja, reporte-ingresos,
> deuda-detalle, venta-detalle, home, configuracion, cliente/datos, producto/datos,
> producto, venta-gasto, producto/kardex. Las páginas con params dinámicos usan
> `use(params)`; el toggle optimista de `producto` usa `setData`.
>
> **Dejadas a propósito** (no encajan sin regresión): páginas con guard de rol en
> dos fases (`auditoria`, `caja/historial`, `configuracion/usuarios`,
> `producto/ajustes`, `superadmin`) y `venta-abono` (side-effects de navegación
> durante la carga).


~22-24 páginas repiten `useState(loading)` + `useEffect(fetch)` + manejo de error. Ya existe
`api-client.ts` (bien hecho, con refresh de token), `loading-state.tsx`, `empty-state.tsx`,
`error-handler.tsx` — falta el **hook que los pegue**:

```ts
// useResource(path) -> { data, loading, error, reload }
```

Reduce cada página en ~15 líneas y unifica el manejo de errores. Alternativa más robusta a
futuro: adoptar **SWR/React Query** (caché, revalidación, dedupe) — encaja con la naturaleza
PWA/offline del proyecto.

## 6. Mejoras a futuro

> ✅ HECHO (paso 5): **Vitest** configurado (`npm test`, `vitest.config.ts` con alias
> `@`). 48 tests sobre lógica pura crítica (tipo-documento flags, reportes/balance,
> format de montos/fechas, locale, permisos) y el wrapper `withAuth` (mapeo de
> 401/403/ApiError/500/exposeErrors). Activados `noUnusedLocals` y
> `noUnusedParameters` en `tsconfig.json` (no detectaron código muerto restante).


- **Tests:** no existe ningún test unitario/integración (solo Playwright e2e con harness). La
  lógica de `tipo-documento` (flags), `reportes`, diffs master-detail y los RPCs son candidatos
  ideales para tests unitarios — son lógica pura y crítica para el dinero.
- **`tsconfig`:** activar `noUnusedLocals` y `noUnusedParameters` para que el compilador
  atrape código muerto automáticamente (hoy depende de revisión manual).
- **Rutas legacy:** `venta/page.tsx` y `venta-lista/page.tsx` solo hacen `redirect("/")`.
  Confirmar que ningún enlace interno apunta ahí y eliminarlas, o documentarlas como
  compatibilidad de URLs antiguas.
- **`dev-harness/` y `bluetoothprinter/`:** asegurar que el harness de dev no se incluye en el
  bundle de producción (excluir por entorno).
- **Consistencia de la capa services:** unificar el estilo — todos llaman `getSupabaseServer()`
  directo menos `producto-service` que usa el "base service". Elegir un solo patrón.

---

## Plan sugerido (por riesgo, de menor a mayor)

1. **Borrado de huérfanos** (§1, §2) — cero riesgo, reversible por git. ~10 archivos.
2. **`permisos.ts`** (§4) — refactor mecánico, sin cambio de comportamiento.
3. **`withAuth`** (§3) — mayor impacto en LOC; migrar ruta por ruta, validando.
4. **`useResource`** (§5) — incremental, página por página.
5. **Tests + flags de tsconfig** (§6) — base de calidad continua.
