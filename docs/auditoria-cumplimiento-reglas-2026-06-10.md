# Auditoría de cumplimiento de reglas del proyecto (CLAUDE.md + AGENTS.md)

**Fecha:** 2026-06-10
**Base:** `CLAUDE.md`, `AGENTS.md`, `docs/auditoria-tecnica.md` (2026-05-09)
**Alcance:** código fuente en `src/` (servicios, API routes, páginas, componentes), migraciones en `supabase/migrations/`, documentación en `docs/`. No incluye verificación contra la BD real (qué migraciones están aplicadas) ni pruebas E2E.

---

## 1. Resumen

| Regla | Estado |
|---|---|
| No usar `asChild` (shadcn + Base UI) | ✅ 0 usos |
| Frontend nunca habla directo con Supabase | ✅ cumple (solo login usa `@/lib/supabase`) |
| Fechas `date`: `toInputDate` / `parseDateOnly` | ⚠️ 6 violaciones (1 bug real, 5 frágiles) |
| Fechas `timestamptz`: `new Date(iso)` al mostrar | ✅ cumple |
| Multi-tenant: filtrar por `IdTenant` | 🔴 fuga en auditoría (ver §2.1) |
| Convención auditoría (`lib/audit.ts`, RPCs) | ✅ rutas de mutación lo usan o delegan en RPC |
| Nomenclatura PascalCase de entidades | ✅ cumple |
| Next.js 16 (`params` como `Promise`) | ✅ cumple |
| `tsc --noEmit` | ✅ sin errores |
| `npm run lint` | ⚠️ 1 error (en `public/sw.js`, generado) + 98 warnings |
| Docs en kebab-case con `Fecha:` | ⚠️ 2 archivos snake_case, algunos sin fecha |

## 2. Hallazgos

### 2.1 ALTO — Fuga multi-tenant en el módulo de auditoría

- `src/services/auditoria-service.ts` consulta `DocumentoAudit` y `DocumentoItemAudit` **sin ningún filtro de tenant**. Las tablas (migración `20260603000000_auditoria_columnas.sql`) **no tienen columna `IdTenant`**; los triggers copian la fila completa del documento en `DataOld`/`DataNew`.
- Las rutas `GET /api/auditoria/documentos` y `GET /api/auditoria/items` solo exigen autenticación: **no llaman `requireRole`**.
- Consecuencia: cualquier usuario autenticado (de cualquier rol y de cualquier tenant) puede leer el historial de cambios de documentos de **todos** los tenants, incluyendo montos, clientes y usuarios.
- Corrección sugerida:
  1. `requireRole(user, ["ADMIN", "SUPERVISOR"])` en ambas rutas (inmediato, una línea).
  2. Filtrar por tenant: o bien agregar `IdTenant` a las tablas de audit (poblada por el trigger desde la fila auditada) o filtrar con un join/`in` sobre `Documento.id` del tenant. Lo primero es más simple y barato.

### 2.2 MEDIO — Bug de fecha UTC en `/api/perdidas` (regla AGENTS.md)

`src/app/api/perdidas/route.ts:90-91`:

```ts
const todayStr = today.toISOString().split("T")[0];
const futureStr = sevenDaysFromNow.toISOString().split("T")[0];
```

Es exactamente el patrón prohibido: de noche en es-CL (UTC-3/-4), `toISOString()` ya pasó a mañana en UTC → "hoy" se corre +1 día. Un producto que vence **hoy** queda fuera de `>= todayStr` y se clasifica como ya vencido (o desaparece de la alerta). Corrección: `toInputDate(today)` y `toInputDate(sevenDaysFromNow)` de `src/lib/format.ts`.

### 2.3 BAJO — Patrón frágil `toISOString().split` en cálculo de "hasta + 1 día"

Cuatro ocurrencias con el mismo idioma:

- `src/services/caja-service.ts:132`
- `src/services/documento-service.ts:109`
- `src/services/auditoria-service.ts:22` y `:46`

Parten de medianoche **local** (`new Date(str + "T00:00:00")`), suman 1 día y serializan con `toISOString()`. En zonas UTC-negativas (es-CL) el resultado es correcto por casualidad (medianoche local = madrugada UTC del mismo día), pero en zonas UTC+ daría el día anterior y viola la regla escrita. Corrección: reemplazar por `toInputDate(next)`.

### 2.4 BAJO — Lint: 1 error y 98 warnings

- El único **error** (`no-this-alias`) está en `public/sw.js`, artefacto generado por Serwist. Debe excluirse en la config de ESLint (`public/sw.js` en `ignores`) para que `npm run lint` quede verde.
- 98 warnings, casi todos `no-unused-vars` (imports/variables muertos en `page.tsx`, `cliente-service.ts`, etc.). Limpieza mecánica.

### 2.5 BAJO — Código muerto con API insegura en `supabase-service.ts`

`getAll`, `getById`, `update`, `deleteItem` genéricos operan **solo por `id`, sin `IdTenant`**. Hoy no son explotables:

- `documentoService.delete` y `clienteService.delete` (que los envuelven) **no tienen llamadores** — código muerto.
- `producto-service` los usa pero las rutas validan tenant antes (verificado en `DELETE /api/productos/[id]`).

Riesgo: que un futuro route los use directo y salte el aislamiento. Sugerencia: borrar los wrappers muertos y/o exigir `tenantId` como parámetro en los genéricos de mutación.

### 2.6 INFO — Capa de servicios importada desde componentes cliente

`src/app/configuracion/usuarios/page.tsx` y `[id]/page.tsx` importan `ROLES_VALIDOS` (valor runtime) desde `@/services/usuario-service`, módulo que importa `supabase-server`. Funciona (la key es anon/pública) pero rompe la separación de capas y arrastra código de servidor al bundle cliente. Mover `ROLES_VALIDOS` y `UsuarioSinPassword` a `src/types/`.

### 2.7 INFO — Documentación

- Snake_case (regla: kebab-case): `propuesta_refactorizacion_pos_multitenant_seguridad.md` y `_v1.md`.
- Sin campo `Fecha:`: `flujo-venta-tecnico.md`, entre otros antiguos.
- Archivos no-doc en `docs/`: `image_a4e017.png`, `image_a545e7.png`, `migration-caja-kardex.sql` (las migraciones viven en `supabase/migrations/`).

## 3. Lo que está bien (verificado, no asumido)

- **`asChild`**: cero ocurrencias en `src/`.
- **Acceso a datos**: ningún componente/página importa `@/lib/supabase`; todo pasa por `lib/api-client` → API routes → servicios con `supabase-server`.
- **Fechas de negocio en UI**: `parseDateOnly` se usa consistentemente para `FechaEmision` (deuda, ventas eliminadas, saldo a favor, link público); `new Date(iso)` solo aparece sobre `timestamptz` (`FechaApertura`, `FechaAudit`, `FechaCreacion`, `Fecha` de kardex) — correcto según AGENTS.md.
- **Multi-tenant en servicios principales**: `caja`, `documento`, `producto`, `cliente`, `kardex`, `usuario`, `categoria`, `negocio` filtran por tenant en todas sus queries (la excepción es auditoría, §2.1).
- **Next.js 16**: todas las rutas dinámicas usan `params: Promise<...>` + `await params`.
- **TypeScript**: `npx tsc --noEmit` pasa limpio.
- **Auditoría de cambios**: las rutas de mutación usan `lib/audit.ts` o delegan en RPCs que escriben los campos de auditoría (convención `IdUsuarioCreacion/Modificacion`).

## 4. Pendientes / próximas decisiones

1. **Decidir prioridad del fix de §2.1** (rol + tenant en auditoría). Es el único hallazgo de seguridad.
2. Fix one-liner de §2.2 (`toInputDate` en perdidas) y los 4 reemplazos de §2.3.
3. Excluir `public/sw.js` del lint y barrer los 98 warnings.
4. Pendientes ya conocidos de otros docs (no re-auditados aquí): aplicar migraciones `20260606*`–`20260609*` en la BD, Fase 3 de TipoDocumento (lógica por flags), Fase 3d multi-sucursal (re-NOT NULL).
