import { NextRequest, NextResponse } from "next/server";
import { usuarioService } from "@/services/usuario-service";
import { createToken } from "@/lib/jwt";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { codigo, password } = body;

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

    const token = await createToken({
      sub: String(user.id),
      codigo: user.Codigo,
      nombre: user.Nombre,
      rol: user.Rol,
      idTenant: user.IdTenant,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        codigo: user.Codigo,
        nombre: user.Nombre,
        rol: user.Rol,
        idTenant: user.IdTenant,
      },
    });

    response.cookies.set({
      name: "token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8, // 8 hours
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}