import { NextRequest, NextResponse } from "next/server";
import { usuarioService } from "@/services/usuario-service";
import { negocioService } from "@/services/negocio-service";
import { sesionService } from "@/services/sesion-service";
import { createToken } from "@/lib/jwt";
import {
  setAccessCookie,
  setRefreshCookie,
  getRequestMeta,
} from "@/lib/auth-cookies";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { codigo, password, remember } = body;

    if (!codigo || !password) {
      return NextResponse.json(
        { error: "Codigo y password requeridos" },
        { status: 400 },
      );
    }

    const user = await usuarioService.validateLogin(codigo, password);
    if (!user) {
      return NextResponse.json(
        { error: "Credenciales invalidas" },
        { status: 401 },
      );
    }

    // Sucursal activa: la asignada al usuario; fallback al default del tenant
    // (caso ADMIN sin IdNegocio fijo).
    const idNegocio =
      user.IdNegocio ??
      (await negocioService.getDefaultForTenant(user.IdTenant))?.id ??
      null;

    // "Recordarme" controla la vida de la SESIÓN (refresh token): 30 días vs
    // 8 horas. El access token (JWT) siempre es corto (45 min) y se renueva
    // contra la BD vía /api/auth/refresh.
    const sessionMaxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8;

    const token = await createToken({
      sub: String(user.id),
      codigo: user.Codigo,
      nombre: user.Nombre,
      rol: user.Rol,
      idTenant: user.IdTenant,
      idNegocio,
    });

    // Sesión respaldada en BD: refresh token opaco (hasheado) + auditoría.
    const { userAgent, ip } = getRequestMeta(req);
    const { token: refreshToken } = await sesionService.crear({
      idUsuario: user.id,
      idTenant: user.IdTenant,
      duracionSegundos: sessionMaxAge,
      userAgent,
      ip,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        codigo: user.Codigo,
        nombre: user.Nombre,
        rol: user.Rol,
        idTenant: user.IdTenant,
        idNegocio,
      },
    });

    setAccessCookie(response, token);
    setRefreshCookie(response, refreshToken, sessionMaxAge);

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}