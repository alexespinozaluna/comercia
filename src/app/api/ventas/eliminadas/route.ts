import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/api-auth";
import { documentoService } from "@/services/documento-service";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const data = await documentoService.getVentasEliminadas(user.idTenant);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/ventas/eliminadas error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
