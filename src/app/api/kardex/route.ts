import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/api-auth";
import { kardexService } from "@/services/kardex-service";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const fechaInicio = searchParams.get("fechaInicio") ?? undefined;
    const fechaFin = searchParams.get("fechaFin") ?? undefined;
    const tipo = searchParams.get("tipo");
    const tipoMovimiento = tipo ? parseInt(tipo) : undefined;

    const data = await kardexService.getAll(user.idTenant, fechaInicio, fechaFin, tipoMovimiento);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/kardex error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}