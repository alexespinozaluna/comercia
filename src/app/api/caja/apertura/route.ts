import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, requireRole } from "@/lib/api-auth";
import { cajaService } from "@/services/caja-service";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    requireRole(user, ["ADMIN", "CAJERO", "SUPERVISOR"]);

    const body = await req.json();
    const montoInicial = parseFloat(body.montoInicial);

    if (!Number.isFinite(montoInicial) || montoInicial < 0) {
      return NextResponse.json(
        { error: "MontoInicial inválido" },
        { status: 400 },
      );
    }

    const existente = await cajaService.getCajaAbierta(user.idTenant);
    if (existente) {
      return NextResponse.json({ error: "Ya existe una caja abierta" }, { status: 400 });
    }

    const data = await cajaService.abrirCaja(user.idTenant, user.id, montoInicial);
    return NextResponse.json({ data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    const status = msg === "Forbidden" ? 403 : 400;
    console.error("POST /api/caja/apertura error:", err);
    return NextResponse.json({ error: msg }, { status });
  }
}
