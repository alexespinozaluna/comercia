import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/api-auth";
import { sesionService } from "@/services/sesion-service";
import { REFRESH_COOKIE } from "@/lib/auth-cookies";
import type { SesionActivaDTO } from "@/types/sesion";

// GET: sesiones activas del usuario autenticado. Marca cuál es la actual
// (la del refresh token de esta petición — la cookie llega por path /api/auth).
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
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
  } catch (err) {
    console.error("GET /api/auth/sesiones error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE ?id=N → revoca esa sesión (solo si es del usuario).
// DELETE sin id → cierra las demás sesiones (todas menos la actual).
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const idParam = req.nextUrl.searchParams.get("id");
    if (idParam) {
      const id = Number(idParam);
      if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ error: "id invalido" }, { status: 400 });
      }
      const ok = await sesionService.revocarPorId(id, user.id);
      if (!ok) {
        return NextResponse.json(
          { error: "Sesión no encontrada" },
          { status: 404 },
        );
      }
      return NextResponse.json({ ok: true });
    }

    const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
    const actualId = refreshToken
      ? await sesionService.idSesionPorToken(refreshToken)
      : null;
    await sesionService.revocarOtrasDelUsuario(user.id, actualId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
