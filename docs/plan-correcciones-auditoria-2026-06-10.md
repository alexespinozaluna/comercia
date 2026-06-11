# Plan: correcciones de la auditoría de cumplimiento

**Fecha:** 2026-06-10
**Base:** [auditoria-cumplimiento-reglas-2026-06-10.md](auditoria-cumplimiento-reglas-2026-06-10.md)
**Estado:** ejecutado 2026-06-10 (commits `b5e2f2b` Fase A, `dccfa66` Fase B, `c5fec2d` Fase C). Decisiones tomadas: roles ADMIN+SUPERVISOR; JSDoc en genéricos (sin refactor); housekeeping de docs pospuesto. La migración `20260610000000_audit_idtenant.sql` queda pendiente de aplicar en Supabase.
**Alcance:** corregir los hallazgos §2.1–§2.6 de la auditoría. El §2.7 (housekeeping de docs) queda como decisión abierta.

---

## Fase A — Seguridad: aislar auditoría por tenant y rol (hallazgo ALTO §2.1)

### A.1 Migración `supabase/migrations/20260610000000_audit_idtenant.sql`

Contexto técnico (verificado en `supabase/script/db_only_squema.sql`):

- `DocumentoAudit` y `DocumentoItemAudit` no tienen `IdTenant`.
- Los triggers `fn_audit_documento` / `fn_audit_documento_item` viven en la BD (no en migraciones); hay que recrearlos con `CREATE OR REPLACE`.
- `Documento` tiene `IdTenant`; `DocumentoItem` **no** → el trigger de items necesita subselect al padre.

Pasos (idempotente, como las migraciones existentes):

1. `ALTER TABLE "DocumentoAudit" ADD COLUMN IF NOT EXISTS "IdTenant" bigint;` (ídem `DocumentoItemAudit`). Nullable: las filas históricas se backfillean, pero un DELETE en cascada (ver edge case) puede no resolver tenant.
2. `CREATE OR REPLACE FUNCTION fn_audit_documento()`: agregar `"IdTenant"` al INSERT tomándolo de `NEW."IdTenant"` / `OLD."IdTenant"` según operación.
3. `CREATE OR REPLACE FUNCTION fn_audit_documento_item()`: tenant vía
   `SELECT "IdTenant" FROM "Documento" WHERE id = COALESCE(NEW."IdDocumento", OLD."IdDocumento")`.
   *Edge case:* en un DELETE en cascada el padre puede ya no existir → queda NULL. Aceptable: la app usa soft-delete (`Estado=0`), los hard-delete son excepcionales.
4. Backfill:
   - `DocumentoAudit`: `SET "IdTenant" = COALESCE((DataNew->>'IdTenant')::bigint, (DataOld->>'IdTenant')::bigint)` (el JSON ya trae la fila completa).
   - `DocumentoItemAudit`: join `DataNew/DataOld->>'IdDocumento'` → `Documento."IdTenant"`; segundo intento contra `DocumentoAudit` para documentos ya borrados.
5. Índices: `(IdTenant, FechaAudit DESC)` en ambas tablas (patrón de consulta del módulo).

### A.2 Código TypeScript

- `src/services/auditoria-service.ts`: `getDocumentoAudits` / `getDocumentoItemAudits` reciben `tenantId: number` como primer parámetro y agregan `.eq("IdTenant", tenantId)`. Sin default — que el compilador obligue a pasarlo.
- `src/app/api/auditoria/documentos/route.ts` y `items/route.ts`:
  - `requireRole(user, ["ADMIN", "SUPERVISOR"])` (mismo criterio que `/api/caja/historial`, que ya es "auditoría de cierres").
  - Pasar `user.idTenant` al servicio.
- `src/types/database.ts`: `IdTenant: number | null` en `DocumentoAudit` y `DocumentoItemAudit`.
- Revisar `src/app/auditoria/page.tsx`: ocultar/redirigir si el rol de sesión no es ADMIN/SUPERVISOR (hoy el guard sería solo del API).

### A.3 Verificación

- `npx tsc --noEmit`.
- Manual: con usuario CAJERO, `GET /api/auditoria/documentos` → 403; con ADMIN → solo filas del propio tenant.

## Fase B — Fechas según AGENTS.md (hallazgos §2.2 MEDIO y §2.3 BAJO)

Reemplazos puntuales, todos con `toInputDate` de `src/lib/format.ts` (ya importable en server):

| Archivo | Línea(s) | Cambio |
|---|---|---|
| `src/app/api/perdidas/route.ts` | 90–91 | `today.toISOString().split("T")[0]` → `toInputDate(today)`; ídem `sevenDaysFromNow` (**bug real**: de noche es-CL corre el día +1) |
| `src/services/caja-service.ts` | 132 | `next.toISOString().split("T")[0]` → `toInputDate(next)` |
| `src/services/documento-service.ts` | 109 | ídem con `fechaFinEnd` |
| `src/services/auditoria-service.ts` | 22, 46 | ídem con `fechaFinEnd` |

Verificación: `tsc` + smoke de los 4 endpoints (home/perdidas, historial caja, listado ventas, auditoría).

## Fase C — Lint y código muerto (hallazgos §2.4, §2.5, §2.6)

1. `eslint.config.mjs`: agregar `"public/sw.js"` (y demás artefactos generados de Serwist en `public/`) a `globalIgnores` → el único **error** de lint desaparece.
2. Borrar código muerto sin llamadores (verificado):
   - `documentoService.delete` (`documento-service.ts:611`)
   - `clienteService.delete` (`cliente-service.ts:127`) y los imports `getAll`/`add` no usados.
   - En `supabase-service.ts`: dejar nota JSDoc en `update`/`deleteItem` de que no filtran tenant y el llamador debe validar (o exigir `tenantId`; ver Pendientes).
3. Mover `ROLES_VALIDOS` y `UsuarioSinPassword` de `usuario-service.ts` a `src/types/` (p. ej. `src/types/usuario.ts`) y actualizar imports en `configuracion/usuarios/*` y el propio servicio → las páginas cliente dejan de importar un módulo de servidor.
4. Barrido mecánico de los 98 warnings `no-unused-vars` (imports/variables muertos en ~15 archivos).

Verificación: `npm run lint` → 0 errores, 0 warnings; `tsc` limpio.

## Fase D — Orden de ejecución y commits

Un commit por fase (mensajes descriptivos, regla COMMIT de AGENTS.md):

1. `fix(seguridad): auditoria filtrada por tenant y rol` (Fase A — migración + código)
2. `fix(fechas): reemplazar toISOString().split por toInputDate (regla AGENTS.md)` (Fase B)
3. `chore(lint): ignorar sw.js generado, borrar codigo muerto y limpiar warnings` (Fase C)

La migración `20260610000000` queda **pendiente de aplicar** en Supabase junto con las ya pendientes (`20260606*`–`20260609*`).

## Aclaración: visualización de fechas según locale configurado

Requisito del usuario (2026-06-10): la fecha debe mostrarse según el locale de
configuración (`es-CL`, `es-PE`, u otros) y **la fecha de negocio debe verse tal
como está guardada, sin importar la hora del día**.

Estado tras la Fase B:

- Las columnas `date` (`FechaEmision`, `FechaVencimiento`) se escriben con
  `toInputDate` y se muestran con `parseDateOnly` → el valor se ve **idéntico al
  guardado** en cualquier zona horaria y a cualquier hora. Cumplido.
- Todo el formateo de `src/lib/format.ts` usa `NEXT_PUBLIC_LOCALE`
  (default `es-CL`); cambiar a `es-PE` u otro solo requiere la variable de
  entorno. Cumplido a nivel deployment.
- **Decisión abierta:** si el locale debe salir de la configuración del
  `Negocio` en BD (per-tenant, para cuentas en distintos países) en vez de la
  variable de entorno (per-deployment), es una feature nueva: columna
  `Locale` en `Negocio` + contexto en el cliente. No se implementó en este ciclo.

## Pendientes / próximas decisiones

1. **Roles de auditoría**: propongo ADMIN + SUPERVISOR (consistente con `/api/caja/historial`). ¿Solo ADMIN?
2. **`supabase-service.ts` genéricos**: ¿nota JSDoc (mínimo) o refactor para exigir `tenantId` en `update`/`deleteItem`? El refactor toca `producto-service` y sus rutas.
3. **Housekeeping de docs (§2.7)**: renombrar los 2 docs snake_case y mover `.png`/`.sql` fuera de `docs/` — ¿se hace en este ciclo o se deja?
4. Aplicación efectiva de las migraciones pendientes en la BD (acción del usuario en Supabase).
