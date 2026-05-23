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
    const montoInicial = parseFloat(body.montoInicial ?? "0");

    const existente = await cajaService.getCajaAbierta(user.idTenant);
    if (existente) {
      return NextResponse.json({ error: "Ya existe una caja abierta" }, { status: 400 });
    }

    const data = await cajaService.abrirCaja(user.idTenant, user.id, montoInicial);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("POST /api/caja/apertura error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
