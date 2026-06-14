import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, requireRole } from "@/lib/api-auth";
import { PERMISOS } from "@/lib/permisos";
import { cajaService } from "@/services/caja-service";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    requireRole(user, PERMISOS.CAJA_Y_GASTOS);

    const body = await req.json();
    const id = parseInt(body.id, 10);
    const montoFinal = parseFloat(body.montoFinal);
    const observacion: string | null =
      typeof body.observacion === "string" ? body.observacion.trim() || null : null;

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }
    if (!Number.isFinite(montoFinal) || montoFinal < 0) {
      return NextResponse.json({ error: "MontoFinal inválido" }, { status: 400 });
    }

    // fn_cerrar_caja valida tenant + Estado=1 + recalcula esperado/diferencia
    const data = await cajaService.cerrarCaja(
      id,
      user.idTenant,
      user.id,
      montoFinal,
      observacion,
    );
    return NextResponse.json({ data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    const status = msg === "Forbidden" ? 403 : 400;
    console.error("POST /api/caja/cierre error:", err);
    return NextResponse.json({ error: msg }, { status });
  }
}
