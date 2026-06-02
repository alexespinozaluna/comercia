import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/api-auth";
import { usuarioService } from "@/services/usuario-service";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (user.rol !== "ADMIN") {
      return NextResponse.json({ error: "Solo ADMIN" }, { status: 403 });
    }

    const data = await usuarioService.listByTenant(user.idTenant);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/usuarios error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (user.rol !== "ADMIN") {
      return NextResponse.json({ error: "Solo ADMIN" }, { status: 403 });
    }

    const body = await req.json();
    const data = await usuarioService.create(
      user.idTenant,
      {
        Codigo: body.Codigo,
        Nombre: body.Nombre,
        Password: body.Password,
        Rol: body.Rol,
        IdNegocio: body.IdNegocio ?? null,
      },
      user.id,
    );
    return NextResponse.json({ data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
