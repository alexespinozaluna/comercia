import { NextRequest, NextResponse } from "next/server";
import { usuarioService } from "@/services/usuario-service";
import { negocioService } from "@/services/negocio-service";
import { createToken } from "@/lib/jwt";

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

    // "Recordarme": sesión larga (30 días); si no, 8 horas. Aplica tanto al
    // exp del JWT como al maxAge de la cookie para que ambos coincidan.
    const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8;
    const expiresIn = remember ? "30d" : "8h";

    const token = await createToken(
      {
        sub: String(user.id),
        codigo: user.Codigo,
        nombre: user.Nombre,
        rol: user.Rol,
        idTenant: user.IdTenant,
        idNegocio,
      },
      expiresIn,
    );

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

    response.cookies.set({
      name: "token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}