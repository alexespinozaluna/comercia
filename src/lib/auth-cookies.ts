import { NextRequest, NextResponse } from "next/server";

// Cookies de auth. El access token (JWT, stateless) y el refresh token (opaco,
// respaldado en SistemaSesion) viajan en cookies separadas.
// Ver docs/propuesta-sesiones-en-bd-refresh-tokens.md.

export const ACCESS_COOKIE = "token";
export const REFRESH_COOKIE = "refresh_token";

/** Debe coincidir con el default de expiración de createToken (jwt.ts). */
export const ACCESS_MAX_AGE = 45 * 60; // 45 min

const isProd = process.env.NODE_ENV === "production";

export function setAccessCookie(res: NextResponse, jwt: string): void {
  res.cookies.set({
    name: ACCESS_COOKIE,
    value: jwt,
    httpOnly: true,
    secure: isProd,
    // Lax (no Strict): en la PWA instalada (standalone) la cadena de navegación
    // se trata como cross-site, y una cookie Strict NO viaja en el redirect
    // /api/auth/refresh → / tras renovar. Eso dejaba al middleware sin access
    // token en cada vuelta → bucle infinito (ERR_TOO_MANY_REDIRECTS). Con Lax la
    // cookie sí se envía en navegaciones GET top-level y el ciclo se rompe.
    sameSite: "lax",
    maxAge: ACCESS_MAX_AGE,
    path: "/",
  });
}

export function setRefreshCookie(
  res: NextResponse,
  token: string,
  maxAgeSeconds: number,
): void {
  res.cookies.set({
    name: REFRESH_COOKIE,
    value: token,
    httpOnly: true,
    secure: isProd,
    // Lax (no Strict): el refresh por navegación de páginas es un GET top-level
    // a /api/auth/refresh y la cookie debe enviarse aunque el origen anterior
    // sea externo (links, PWA). Acotada a /api/auth para no viajar en cada API.
    sameSite: "lax",
    maxAge: maxAgeSeconds,
    path: "/api/auth",
  });
}

export function clearAuthCookies(res: NextResponse): void {
  res.cookies.set({
    name: ACCESS_COOKIE,
    value: "",
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  res.cookies.set({
    name: REFRESH_COOKIE,
    value: "",
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 0,
    path: "/api/auth",
  });
}

/** Segundos restantes hasta un instante ISO (>= 0). Para el maxAge del refresh. */
export function maxAgeUntil(expiraEnIso: string): number {
  return Math.max(
    0,
    Math.floor((new Date(expiraEnIso).getTime() - Date.now()) / 1000),
  );
}

/** UserAgent + IP del request, para auditoría de la sesión. */
export function getRequestMeta(req: NextRequest): {
  userAgent: string | null;
  ip: string | null;
} {
  const userAgent = req.headers.get("user-agent");
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  return { userAgent, ip };
}
