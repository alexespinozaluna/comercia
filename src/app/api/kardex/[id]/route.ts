import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/api-auth";
import { kardexService } from "@/services/kardex-service";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const { id } = await params;
    const productId = parseInt(id);

    const { searchParams } = new URL(req.url);
    const fechaInicio = searchParams.get("fechaInicio") ?? undefined;
    const fechaFin = searchParams.get("fechaFin") ?? undefined;

    const data = await kardexService.getByProducto(productId, user.idTenant, fechaInicio, fechaFin);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/kardex/[id] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}