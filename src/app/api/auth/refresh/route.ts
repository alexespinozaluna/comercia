import { NextRequest, NextResponse } from "next/server";
import { sesionService } from "@/services/sesion-service";
import { usuarioService } from "@/services/usuario-service";
import { negocioService } from "@/services/negocio-service";
import { createToken } from "@/lib/jwt";
import {
  REFRESH_COOKIE,
  setAccessCookie,
  setRefreshCookie,
  clearAuthCookies,
  maxAgeUntil,
  getRequestMeta,
} from "@/lib/auth-cookies";

type RefreshOutcome =
  | { ok: true; accessToken: string; refreshToken?: string; refreshMaxAge?: number }
  | { ok: false };

/**
 * Núcleo compartido por POST (api-client) y GET (navegación de páginas):
 * valida + rota el refresh token y reemite un access JWT con claims FRESCOS
 * (rol/tenant/negocio leídos de la BD, no del token viejo). Expulsa usuarios
 * desactivados (Estado != 1).
 */
async function doRefresh(req: NextRequest): Promise<RefreshOutcome> {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return { ok: false };

  const { userAgent, ip } = getRequestMeta(req);
  const rot = await sesionService.rotar(refreshToken, { userAgent, ip });
  if (!rot.ok) return { ok: false };

  // Claims frescos desde BD; si el usuario fue desactivado, se le expulsa.
  const user = await usuarioService.getById(rot.idUsuario, rot.idTenant);
  if (!user || user.Estado !== 1) {
    await sesionService.revocarDelUsuario(rot.idUsuario);
    return { ok: false };
  }

  // Sucursal activa: la persistida en la sesión (la que el ADMIN eligió) manda;
  // si no hay, la fija del usuario; si no, el default del tenant.
  const idNegocio =
    rot.idNegocioActivo ??
    user.IdNegocio ??
    (await negocioService.getDefaultForTenant(user.IdTenant))?.id ??
    null;

  const accessToken = await createToken({
    sub: String(user.id),
    codigo: user.Codigo,
    nombre: user.Nombre,
    rol: user.Rol,
    idTenant: user.IdTenant,
    idNegocio,
  });

  // rotada=false → carrera en ventana de gracia: otro request ya emitió la
  // cookie de refresh nueva; aquí solo reemitimos el access token.
  if (rot.rotada && rot.token && rot.expiraEn) {
    return {
      ok: true,
      accessToken,
      refreshToken: rot.token,
      refreshMaxAge: maxAgeUntil(rot.expiraEn),
    };
  }
  return { ok: true, accessToken };
}

/** Llamado por api-client al recibir 401 por access token vencido. */
export async function POST(req: NextRequest) {
  const outcome = await doRefresh(req);
  if (!outcome.ok) {
    const res = NextResponse.json({ error: "Sesión expirada" }, { status: 401 });
    clearAuthCookies(res);
    return res;
  }
  const res = NextResponse.json({ ok: true });
  setAccessCookie(res, outcome.accessToken);
  if (outcome.refreshToken !== undefined && outcome.refreshMaxAge !== undefined) {
    setRefreshCookie(res, outcome.refreshToken, outcome.refreshMaxAge);
  }
  return res;
}

/** Llamado por el middleware al navegar a una página con el access vencido. */
export async function GET(req: NextRequest) {
  const next = sanitizeNext(req.nextUrl.searchParams.get("next"));
  const outcome = await doRefresh(req);

  if (!outcome.ok) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    clearAuthCookies(res);
    return res;
  }
  const res = NextResponse.redirect(new URL(next, req.url));
  setAccessCookie(res, outcome.accessToken);
  if (outcome.refreshToken !== undefined && outcome.refreshMaxAge !== undefined) {
    setRefreshCookie(res, outcome.refreshToken, outcome.refreshMaxAge);
  }
  return res;
}

/** Evita open-redirect: solo rutas internas absolutas (no "//", no esquema). */
function sanitizeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}
