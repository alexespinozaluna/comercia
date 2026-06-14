import { NextResponse } from "next/server";
import { withAuth, ApiError } from "@/lib/api-handler";
import { sesionService } from "@/services/sesion-service";
import { REFRESH_COOKIE } from "@/lib/auth-cookies";
import type { SesionActivaDTO } from "@/types/sesion";

// GET: sesiones activas del usuario autenticado. Marca cuál es la actual
// (la del refresh token de esta petición — la cookie llega por path /api/auth).
export const GET = withAuth(async (req, { user }) => {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  const actualId = refreshToken
    ? await sesionService.idSesionPorToken(refreshToken)
    : null;
  const filas = await sesionService.listarActivasDelUsuario(user.id);
  const data: SesionActivaDTO[] = filas.map((f) => ({
    ...f,
    esActual: f.id === actualId,
  }));
  return NextResponse.json({ data });
});

// DELETE ?id=N → revoca esa sesión (solo si es del usuario).
// DELETE sin id → cierra las demás sesiones (todas menos la actual).
export const DELETE = withAuth(
  async (req, { user }) => {
    const idParam = req.nextUrl.searchParams.get("id");
    if (idParam) {
      const id = Number(idParam);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ApiError(400, "id invalido");
      }
      const ok = await sesionService.revocarPorId(id, user.id);
      if (!ok) {
        throw new ApiError(404, "Sesión no encontrada");
      }
      return NextResponse.json({ ok: true });
    }

    const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
    const actualId = refreshToken
      ? await sesionService.idSesionPorToken(refreshToken)
      : null;
    await sesionService.revocarOtrasDelUsuario(user.id, actualId);
    return NextResponse.json({ ok: true });
  },
  { exposeErrors: true },
);
