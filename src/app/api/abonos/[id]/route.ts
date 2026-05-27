import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, requireRole } from "@/lib/api-auth";
import { documentoService } from "@/services/documento-service";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    requireRole(user, ["ADMIN", "CAJERO", "COBRANZA", "SUPERVISOR"]);

    const { id } = await params;
    const idAbono = parseInt(id);
    if (!idAbono || idAbono <= 0) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }

    const body = await req.json();
    const { FechaEmision, Concepto, Total, IdMetodoPago } = body;

    if (!FechaEmision) {
      return NextResponse.json({ error: "FechaEmision requerida" }, { status: 400 });
    }
    if (Total == null || Total <= 0) {
      return NextResponse.json({ error: "El monto debe ser mayor a cero" }, { status: 400 });
    }

    const result = await documentoService.modificarAbono(
      idAbono,
      Total,
      FechaEmision,
      Concepto ?? null,
      IdMetodoPago ?? null,
      user.idTenant,
    );

    return NextResponse.json({ data: result });
  } catch (err) {
    // Surface RPC business errors (p.ej. "El monto ingresado es mayor a la deuda")
    const msg = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
