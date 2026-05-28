import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/api-auth";
import { negocioService } from "@/services/negocio-service";
import { createToken } from "@/lib/jwt";

// POST: cambia la sucursal activa de la sesión. Valida que el negocio
// pertenezca al tenant del usuario y re-emite el token con el nuevo idNegocio.
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { idNegocio } = await req.json();
    if (!idNegocio || idNegocio <= 0) {
      return NextResponse.json({ error: "idNegocio requerido" }, { status: 400 });
    }

    const negocio = await negocioService.getById(idNegocio, user.idTenant);
    if (!negocio) {
      return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
    }
    if (negocio.Estado !== 1) {
      return NextResponse.json({ error: "El negocio está inactivo" }, { status: 400 });
    }

    const token = await createToken({
      sub: String(user.id),
      codigo: user.codigo,
      nombre: user.nombre,
      rol: user.rol,
      idTenant: user.idTenant,
      idNegocio: negocio.id,
    });

    const response = NextResponse.json({
      data: {
        id: user.id,
        codigo: user.codigo,
        nombre: user.nombre,
        rol: user.rol,
        idTenant: user.idTenant,
        idNegocio: negocio.id,
      },
    });

    response.cookies.set({
      name: "token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8, // 8 horas
      path: "/",
    });

    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
