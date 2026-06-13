import { NextRequest, NextResponse } from "next/server";
import { sesionService } from "@/services/sesion-service";
import { REFRESH_COOKIE, clearAuthCookies } from "@/lib/auth-cookies";

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ ok: true });

  // Logout real: revoca la sesión en BD (el access JWT muere solo en ≤45 min).
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    try {
      await sesionService.revocarPorHash(refreshToken);
    } catch (err) {
      // No bloquear el logout del navegador si la revocación falla.
      console.error("Logout: error revocando sesión:", err);
    }
  }

  clearAuthCookies(response);
  return response;
}
