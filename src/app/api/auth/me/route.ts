import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        codigo: user.codigo,
        nombre: user.nombre,
        rol: user.rol,
        idTenant: user.idTenant,
        idNegocio: user.idNegocio,
      },
    });
  } catch {
    return NextResponse.json({ error: "Token invalido" }, { status: 401 });
  }
}