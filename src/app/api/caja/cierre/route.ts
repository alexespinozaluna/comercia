import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/api-auth";
import { cajaService } from "@/services/caja-service";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const { id, montoFinal } = body;

    if (!id || montoFinal == null) {
      return NextResponse.json({ error: "id y montoFinal requeridos" }, { status: 400 });
    }

    await cajaService.cerrarCaja(parseInt(id), user.id, parseFloat(montoFinal));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/caja/cierre error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
