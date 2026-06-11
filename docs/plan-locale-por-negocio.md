# Plan: Locale por Negocio (BD) para formato de fechas y números

**Fecha:** 2026-06-10
**Base:** [plan-correcciones-auditoria-2026-06-10.md](plan-correcciones-auditoria-2026-06-10.md) (§Aclaración: visualización de fechas según locale configurado)
**Estado:** propuesto, pendiente de validación
**Alcance:** que el formato de fechas y números siga el `Locale` del **negocio activo** guardado en BD (`es-CL`, `es-PE`, etc.), en vez de la variable de entorno `NEXT_PUBLIC_LOCALE` (per-deployment). Una misma instancia podrá atender cuentas/sucursales de distintos países.

---

## Contexto técnico (verificado)

- Hoy el locale es `const localInfo = process.env.NEXT_PUBLIC_LOCALE ?? "es-CL"` a nivel de módulo en `src/lib/format.ts`; lo usan `formatNumero`, `numToString`, `formatN2`, `cantidadString`, `fechaCortaHora` (partes de fecha/hora).
- `parseDateOnly` / `toInputDate` / `fechaString` **no** dependen del locale (calendario puro) → la garantía "la fecha se ve tal como está guardada" no se toca.
- El negocio activo viene de la sesión (`authUser.idNegocio`); el bootstrap del usuario está en `app-shell.tsx` (`getCurrentUser()` → `setAuthUser`), y el cambio de sucursal en `negocio-selector.tsx` (`POST /api/sesion/negocio` + `router.push("/") + refresh`).
- En el servidor, `format.ts` solo se usa para `toInputDate` (sin locale) → **no hace falta locale dinámico server-side**. La excepción es el ticket, que genera el RPC `generate_ticket_text` en Postgres (ver Pendientes).
- `Negocio` se edita en `/configuracion` (Nombre, Dirección, Teléfono, Logo) vía `PUT /api/negocio` → `negocioService.update` (guard de tenant + audit).

## Fase 1 — BD y API

1. Migración `supabase/migrations/20260611000000_negocio_locale.sql` (idempotente):
   ```sql
   ALTER TABLE "Negocio" ADD COLUMN IF NOT EXISTS "Locale" varchar(10) NOT NULL DEFAULT 'es-CL';
   ```
   El DEFAULT cubre las filas existentes; sin backfill adicional.
2. `src/types/database.ts`: `Locale: string` en `Negocio`.
3. `PUT /api/negocio`: incluir `Locale` en los campos aceptados (validar contra la lista de locales soportados para no guardar basura).

## Fase 2 — Formato dinámico en el cliente

1. `src/lib/format.ts`: cambiar la constante por estado de módulo:
   ```ts
   let currentLocale = process.env.NEXT_PUBLIC_LOCALE ?? "es-CL"; // fallback
   export function setLocale(l: string) { currentLocale = l; }
   export function getLocale() { return currentLocale; }
   ```
   Las funciones de formato leen `currentLocale`. **La API sigue siendo síncrona: cero cambios en los ~40 consumidores.** `NEXT_PUBLIC_LOCALE` queda como fallback (sin negocio cargado / link público).
2. Bootstrap en `app-shell.tsx`: al resolver `authUser`, cargar el negocio activo (`GET /api/negocio`, ya se consulta en `NegocioSelector`) y llamar `setLocale(activo.Locale)`. Guardar también `locale` en `app-store` para que un cambio dispare re-render (el módulo solo no re-renderiza).
3. Cambio de sucursal (`negocio-selector.tsx` → `cambiar`): tras el `POST /api/sesion/negocio`, `setLocale(n.Locale)`; el flujo existente (`router.push("/") + router.refresh() + triggerRefresh`) ya recarga las vistas con el nuevo formato.
4. Link público (`/p/deuda/[token]`, sin sesión): usa el fallback de entorno. Si se quiere el locale del negocio dueño del link, el endpoint público puede devolverlo en la respuesta (decisión abierta #3).

## Fase 3 — UI de configuración

`/configuracion`: agregar Select "País / formato" junto a Nombre/Dirección/Teléfono, con lista cerrada inicial:

| Valor | Etiqueta |
|---|---|
| `es-CL` | Chile (es-CL) |
| `es-PE` | Perú (es-PE) |
| `es-AR` | Argentina (es-AR) |
| `es-BO` | Bolivia (es-BO) |
| `es-CO` | Colombia (es-CO) |
| `es-MX` | México (es-MX) |

La misma lista vive en `src/types/` (p. ej. `LOCALES_VALIDOS`) y la valida el API (patrón `ROLES_VALIDOS`).

## Verificación

- `tsc` + lint + build.
- Manual: cambiar Locale del negocio a `es-PE` en `/configuracion` → montos y fechas cortas re-formatean (es-PE usa `1,234.56`; es-CL `1.234,56`); cambiar de sucursal con otro Locale → el formato cambia con la sucursal; logout/link público → fallback `NEXT_PUBLIC_LOCALE`.

## Pendientes / próximas decisiones

1. **Símbolo de moneda**: `numToString` antepone `"$ "` fijo; Perú usa `S/`. Locale ≠ moneda → propongo columna `Moneda` en `Negocio` en un ciclo posterior (no bloquea este plan).
2. **Ticket**: `generate_ticket_text` (RPC en Postgres) formatea montos en SQL sin conocer el Locale. Si el ticket debe seguir el formato del negocio, pasar `p_locale` al RPC o mover el formateo a TS. Ciclo posterior.
3. **Link público de deuda**: ¿usar el Locale del negocio dueño del link (el endpoint lo devolvería) o el fallback de entorno? Propongo lo primero, en este mismo ciclo si lo confirmas.
4. `date-fns` con `locale: es` (nombres de mes en español genérico) sirve para todos los `es-*`; no se toca.
