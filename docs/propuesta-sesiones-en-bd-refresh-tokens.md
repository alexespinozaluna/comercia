# Propuesta: sesiones respaldadas en BD (refresh tokens)

Fecha: 2026-06-12 · Plan añadido 2026-06-13 · **Fases 1+2 implementadas 2026-06-13**
Estado: **Implementado (Fases 1 y 2)** — falta solo Fase 3 (UI de sesiones activas)
Relacionado: `docs/recordarme-persistencia-sesion.md`

## Contexto

Hoy la sesión es un JWT *stateless* en cookie `httpOnly`:

- Login (`src/app/api/auth/login/route.ts`): emite JWT firmado con
  `JWT_SECRET_KEY`. "Recordarme" → 30 días; sin marcar → 8 horas.
- Middleware (`src/middleware.ts`): solo verifica firma + expiración.
  **Nunca consulta la BD.**
- Logout (`src/app/api/auth/logout/route.ts`): borra la cookie del navegador;
  el token en sí sigue siendo válido hasta su `exp`.

## Problema

Con tokens de 30 días sin estado en servidor:

1. **Sin revocación.** Un token filtrado (dispositivo robado, equipo
   compartido) es válido 30 días y no hay forma de invalidarlo.
2. **Logout no invalida.** Solo borra la cookie local; una copia del token
   sigue funcionando.
3. **Desactivar un usuario no lo expulsa.** Sus sesiones activas siguen
   operando hasta expirar.
4. **Claims congelados.** `rol`, `idTenant`, `idNegocio` viajan en el JWT;
   cambios de rol/sucursal no aplican hasta que el token expire.
5. **Cambio de contraseña no cierra sesiones.**

Con 8 horas estos riesgos eran tolerables; con 30 días no.

## Opciones evaluadas

### A. Sesión completa en BD (session ID opaco)

Cookie con un ID opaco; cada request valida contra una tabla de sesiones.

- ✅ Revocación inmediata y total.
- ❌ Una consulta a Supabase **en cada request** desde el middleware
  (incluye navegación de páginas): latencia para toda la app.

### B. Híbrido: access token corto + refresh token en BD (recomendada)

- JWT de acceso de vida corta (30–60 min), igual con o sin "Recordarme".
  El middleware lo sigue verificando sin tocar la BD → costo cero por request.
- Refresh token **opaco** guardado **hasheado** (SHA-256) en tabla
  `SistemaSesion`, en su propia cookie `httpOnly` (path `/api/auth`).
  "Recordarme" controla su vida: 30 días vs 8 horas.
- Endpoint `/api/auth/refresh`: valida contra BD, **rota** el token
  (invalida el anterior, emite nuevo) y reemite el JWT con claims frescos.
- Revocar = borrar/expirar la fila: logout real, "cerrar todas las
  sesiones", expulsión de usuarios desactivados.

- ✅ Ventana de exposición de un token robado: ~1 h en vez de 30 días.
- ✅ La rotación permite detectar reuso (token viejo usado dos veces =
  posible robo → matar toda la familia de sesiones).
- ✅ Habilita vista de "sesiones activas" por usuario/dispositivo.
- ❌ Más piezas: tabla nueva, endpoint refresh, lógica de reintento en el
  cliente (`api-client`) cuando recibe 401 por access token vencido.

### C. Parche mínimo: `TokenVersion` en `SistemaUsuario`

Columna entera; el JWT lleva la versión y cada API route la compara.
Cambiar contraseña / desactivar → incrementar versión → todos los tokens
del usuario mueren.

- ✅ Cambio pequeño; cubre los riesgos 2, 3 y 5 a nivel de usuario.
- ❌ No revoca sesiones individuales (es todo-o-nada por usuario).
- ❌ Requiere consulta a BD por request en las API routes (no en middleware,
  que es edge), o cache con TTL.

## Recomendación

**Opción B.** Es el patrón estándar de la industria para "recordarme" largo:
mantiene el middleware rápido y stateless, y mueve el estado revocable a una
sola tabla con tráfico bajo (solo en login/refresh/logout).

### Esquema propuesto

```sql
create table "SistemaSesion" (
  id              bigint generated always as identity primary key,
  "IdUsuario"     bigint not null references "SistemaUsuario"(id),
  "IdTenant"      bigint not null,
  "TokenHash"     text not null unique,      -- sha256 del refresh token
  "Familia"       uuid not null,             -- cadena de rotación
  "ExpiraEn"      timestamptz not null,
  "RevocadoEn"    timestamptz,
  "UserAgent"     text,
  "Ip"            text,
  "FechaCreacion" timestamptz not null default now(),
  "UltimoUso"     timestamptz
);
create index on "SistemaSesion" ("IdUsuario") where "RevocadoEn" is null;
```

### Flujo

1. **Login**: crea fila en `SistemaSesion` + emite access JWT (45 min) y
   cookie `refresh_token` (30 d con remember / 8 h sin).
2. **Request normal**: middleware verifica JWT; sin BD.
3. **Access vencido**: `api-client` recibe 401 → POST `/api/auth/refresh` →
   valida hash en BD, rota token, reemite JWT con claims frescos → reintenta
   el request original. Para navegación de páginas, el middleware redirige a
   una ruta de refresh antes de mandar a `/login`.
4. **Logout**: marca `RevocadoEn` en la fila + borra ambas cookies.
5. **Reuso detectado** (hash ya rotado/revocado vuelve a llegar): revocar
   toda la `Familia`.

### Alcance estimado

- Migración SQL (tabla + índices).
- `src/lib/jwt.ts`: sin cambios de fondo (solo default de expiración).
- `src/app/api/auth/login/route.ts`, `logout/route.ts`, nuevo
  `refresh/route.ts`.
- `src/lib/api-client.ts`: interceptor de 401 con refresh + retry.
- `src/middleware.ts`: redirigir a refresh antes que a `/login` cuando el
  access token expiró pero existe cookie de refresh.
- Opcional fase 2: página "Sesiones activas" con botón de cierre remoto.

## Decisión

**Opción B aprobada (2026-06-13).** Es viable y de riesgo medio: el access token
sigue siendo el mismo JWT *stateless*, así que el grueso del backend no cambia. El
punto de verificación ya está centralizado (`jwt.ts` → `verifyToken`,
`api-auth.ts` → `getCurrentUserFromRequest`, `middleware.ts`), y las convenciones
del repo (migraciones, auditoría, `Estado=1/0` como flag de activo) ya soportan lo
que hace falta. Lo nuevo es perimetral: una tabla, un endpoint y un interceptor.

## Plan de implementación (aterrizado al código actual)

### Lo que ya juega a favor

- **Verificación centralizada.** Solo `middleware.ts` y `api-auth.ts` llaman
  `verifyToken`; bajar la vida del access token no obliga a tocar rutas/servicios.
- **Cookie y claims ya únicos.** Cookie `token`, claims
  `{sub, codigo, nombre, rol, idTenant, idNegocio}`; el refresh los reemite con
  valores frescos desde BD.
- **`Estado=1/0`** en `SistemaUsuario` ya es el flag de activo → el refresh
  consulta `Estado=1` y "expulsar usuario desactivado" sale gratis.
- **`api-client.ts`** son 4 funciones con el mismo patrón `fetch → if !res.ok`;
  centralizar el retry de 401 en un `request()` interno es un refactor pequeño.

### Cambios por archivo

| Archivo | Cambio |
|---|---|
| migración nueva `…_sistema_sesion.sql` | Tabla `SistemaSesion` (esquema de arriba) + índice parcial. Sin RPC: inserts/updates de una sola tabla, no master-detail. |
| `src/lib/jwt.ts` | Default de expiración `8h → 45m`. Sin cambios de fondo. |
| `src/services/sesion-service.ts` (nuevo) | `crear`, `rotar`, `revocar`, `revocarFamilia`, `revocarTodasDelUsuario`. Hash SHA-256 del token opaco. |
| `src/app/api/auth/login/route.ts` | Tras `validateLogin`: crea fila en `SistemaSesion`, set cookie `refresh_token` (httpOnly, `path /api/auth/refresh`, 30d/8h según remember) **+** access JWT 45m. |
| `src/app/api/auth/refresh/route.ts` (nuevo) | `POST` (api-client) y `GET` (navegación con `?next=`). Valida hash → rota → reemite JWT con claims frescos. Reuso → revoca la familia. |
| `src/app/api/auth/logout/route.ts` | `RevocadoEn = now()` en la fila + borra **ambas** cookies. |
| `src/lib/api-client.ts` | `request()` interno: en 401 → `POST /api/auth/refresh` una vez → reintenta el request original. |
| `src/middleware.ts` | Access expirado/ausente en request de **página** → `redirect /api/auth/refresh?next=<path>` (añadir esa ruta a `PUBLIC_PATHS` para no recursar). Request de **API** → sigue devolviendo 401 (lo maneja el cliente). |

### Filos a vigilar

1. **Middleware es edge, no toca BD** (así debe quedar). Para navegación de
   páginas no valida el refresh: solo redirige a `GET /api/auth/refresh?next=…`,
   que corre en Node, lee la cookie (su `path` coincide) y valida/rota/redirige.
   Cuesta una redirección extra cada ~45 min de uso activo.
2. **Carrera de rotación (principal).** Varias peticiones disparando refresh a la
   vez tras expirar se invalidan entre sí → falsos "reuso" y logout espurio.
   Mitigar desde el inicio: **ventana de gracia** (aceptar el token recién rotado
   ~10–30 s) o serializar el refresh en el cliente con una promesa compartida.
3. **`sameSite: "lax"`** para que el `GET` de refresh por navegación mande la
   cookie; `secure` solo en producción (ya contemplado).

### Fases

- **Fase 1 (núcleo):** migración + `sesion-service` + login/logout/refresh + JWT
  a 45m. Ya hay revocación real y logout que invalida.
- **Fase 2 (resiliencia):** interceptor 401 en `api-client` + redirect en
  middleware + ventana de gracia anti-carrera.
- **Fase 3 (opcional):** página "Sesiones activas" con cierre remoto; revocar todo
  al cambiar contraseña / desactivar usuario.

> No liberar Fase 1 sin Fase 2: con JWT de 45m pero sin interceptor, los usuarios
> verían 401 a media sesión.

## Implementación (2026-06-13) — Fases 1 y 2

Entregado en una sola tanda. Archivos:

- **Migración** `supabase/migrations/20260613000000_sistema_sesion.sql` — tabla
  `SistemaSesion` + índice parcial. **Pendiente de aplicar en Supabase.**
- **Tipo** `SistemaSesion` en `src/types/database.ts`.
- **`src/services/sesion-service.ts`** (nuevo): `crear`, `rotar`,
  `revocarPorHash`, `revocarFamilia`, `revocarDelUsuario`. Token opaco
  `randomUUID()`, guardado como SHA-256.
- **`src/lib/auth-cookies.ts`** (nuevo): helper único de cookies (set/clear de
  `token` y `refresh_token`, `maxAgeUntil`, `getRequestMeta`). Centraliza la
  config para login/logout/refresh.
- **`src/lib/jwt.ts`**: default de expiración del access token → **45 min**.
- **`src/app/api/auth/login/route.ts`**: crea sesión en BD + emite `token` (45m)
  y `refresh_token` (duración 30d/8h según "Recordarme").
- **`src/app/api/auth/refresh/route.ts`** (nuevo): `POST` (api-client) y `GET`
  (navegación, con `?next=` saneado contra open-redirect). Rota, reemite JWT con
  claims frescos de BD y expulsa usuarios con `Estado != 1`.
- **`src/app/api/auth/logout/route.ts`**: `revocarPorHash` + borra ambas cookies.
- **`src/lib/api-client.ts`**: interceptor de 401 con refresh deduplicado
  (promesa compartida) + un reintento; si el refresh falla → `window.location` a
  `/login`.
- **`src/middleware.ts`**: navegación de página con access ausente/expirado →
  redirige a `/api/auth/refresh?next=…` (ruta añadida a `PUBLIC_PATHS`); API
  sigue devolviendo 401.

### Decisiones tomadas (concretan el plan)

- **Cookie `token`**: `SameSite=Strict`, `path=/`, 45 min. **Cookie
  `refresh_token`**: `SameSite=Lax`, `path=/api/auth`, duración de la sesión. Lax
  en el refresh para que el GET de navegación la envíe aunque el origen previo
  sea externo (links/PWA).
- **Expiración absoluta en la rotación**: la fila nueva hereda el `ExpiraEn` de la
  vieja. La sesión "Recordarme" dura 30 días **desde el login**, no se desliza
  indefinidamente con el uso (tope de seguridad).
- **Ventana de gracia = 30 s**: un refresh token ya rotado se acepta 30 s para
  cubrir carreras de requests paralelos; pasado ese lapso, su reaparición se
  trata como reuso y se revoca toda la `Familia`.
- **Sin RPC**: son escrituras de una sola tabla, no master-detail; van directas
  por `getSupabaseServer()`.
- **`revocarDelUsuario`** ya existe pero aún no se cablea a cambio de contraseña /
  desactivación de usuario (queda para cuando se quiera ese efecto; hoy el refresh
  ya expulsa al desactivado en ≤45 min vía `Estado`).

### Sucursal activa del ADMIN (`IdNegocioActivo`)

El access token corto introdujo una regresión: el ADMIN (con `IdNegocio = NULL`)
elige una sucursal activa que viajaba **solo en el claim del JWT**; al refrescar
a los 45 min, `/api/auth/refresh` recomputa los claims desde BD y volvía al
default del tenant. Solución:

- Migración `20260613010000_sesion_negocio_activo.sql`: columna
  `SistemaSesion.IdNegocioActivo`.
- `login` la setea al crear la sesión; `rotar` la arrastra a la fila nueva;
  `refresh` la usa con prioridad: `IdNegocioActivo ?? user.IdNegocio ?? default`.
- `POST /api/sesion/negocio` (cambiar sucursal) llama
  `sesionService.setNegocioActivoDelUsuario(idUsuario, idNegocio)` y emite el
  access token con `setAccessCookie` (antes seteaba la cookie a mano con
  `maxAge` de 8h y `SameSite=Lax` — quedaba inconsistente con el nuevo esquema).
- Se persiste **por usuario** (todas sus sesiones vivas), no por sesión, porque
  la cookie `refresh_token` (path `/api/auth`) no llega a ese endpoint y no se
  puede identificar la sesión exacta. Trade-off aceptable: cambiar de sucursal
  en un dispositivo se propaga a los demás tras su próximo refresh.

### Verificación

`npx tsc --noEmit` y `npm run lint` limpios. **Smoke test en runtime OK
(2026-06-13)**: login (2 cookies + fila en `SistemaSesion`), refresh por
navegación (`/api/auth/refresh?next=…`, rotación con misma `Familia`), refresh
por API (401 → POST refresh → reintento), y logout (cookies borradas + fila
revocada). Ambas migraciones aplicadas en Supabase. **Flujo de sucursal del
ADMIN verificado por curl (2026-06-13)**: login (idNegocio=1 default) → cambiar a
sucursal 2 → refresh (recomputa desde BD) → sigue en 2 (sin el fix volvería a 1,
porque `admin.IdNegocio` es NULL y el default es 1).

### Purga de sesiones (oportunista en el login)

`sesionService.purgarVencidas(retencionHoras = 24)` borra filas **revocadas o
expiradas** con más de 24 h de antigüedad (`RevocadoEn.lt.corte OR
ExpiraEn.lt.corte`); las revocadas recientes se conservan para no perder la
**detección de reuso**. Se llama desde `login/route.ts` (try/catch, no rompe el
login si falla). Sin migración: es un `DELETE` de una tabla por supabase-js.
**Verificado (2026-06-13)**: fila con `ExpiraEn` de hace 2 días → tras un login
desaparece.

## Pendientes / próximas decisiones

- Fase 3 (opcional): página "Sesiones activas" + cablear `revocarDelUsuario` a
  cambio de contraseña / desactivación de usuario.
