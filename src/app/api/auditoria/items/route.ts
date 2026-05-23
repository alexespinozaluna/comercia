import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/api-auth";
import { auditoriaService } from "@/services/auditoria-service";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const fechaInicio = searchParams.get("fechaInicio") ?? undefined;
    const fechaFin = searchParams.get("fechaFin") ?? undefined;
    const operacion = searchParams.get("operacion") ?? undefined;
    const data = await auditoriaService.getDocumentoItemAudits(fechaInicio, fechaFin, operacion);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/auditoria/items error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
