# "Recordarme": persistencia real de la sesión

Fecha: 2026-06-05
Alcance:
- `src/lib/jwt.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/login/page.tsx`

## Síntoma

Al marcar "Recordarme" la sesión no se conservaba: pedía iniciar sesión cada
vez que el usuario volvía a entrar.

## Causa

El checkbox "Recordarme" solo guardaba el **nombre de usuario** en
`localStorage` para precargar el campo; **no afectaba la sesión**. El token vivía
siempre 8 horas, marcado o no:

- Cookie `token` con `maxAge` fijo de 8h (`login/route.ts`).
- JWT con `setExpirationTime("8h")` fijo (`jwt.ts`).

A las 8 horas (típicamente al día siguiente) el token expiraba y el middleware
redirigía a `/login`.

## Cambio

"Recordarme" ahora controla la duración real de la sesión (JWT exp + cookie
`maxAge`, alineados):

- `createToken(payload, expiresIn = "8h")` acepta la expiración.
- En el login API, `remember` define:
  - Marcado → **30 días** (`maxAge = 60*60*24*30`, JWT `"30d"`).
  - Sin marcar → **8 horas** (comportamiento previo).
- `login/page.tsx` envía `remember` en el body del POST.

## Decisión (validada con el usuario)

Duración 30 días (marcado) / 8 horas (sin marcar). Ambas cookies persistentes.

## Notas

- No se cambió la verificación del token ni el middleware.
- Si en el futuro se quiere "cerrar al cerrar el navegador" para la opción sin
  marcar, habría que omitir `maxAge`/`expires` para una cookie de sesión.
