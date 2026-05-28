import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/api-auth";
import { cajaService } from "@/services/caja-service";

/**
 * GET /api/caja/arqueo?id=<idCaja>
 *
 * Si se omite `id`, intenta usar la caja abierta del tenant.
 * Devuelve el desglose vivo (no persistido) calculado por fn_caja_arqueo:
 * inicial + ventas efectivo + abonos efectivo − gastos efectivo = esperado.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const idParam = req.nextUrl.searchParams.get("id");
    let idCaja: number | null = idParam ? parseInt(idParam, 10) : null;

    if (!idCaja || !Number.isFinite(idCaja) || idCaja <= 0) {
      const abierta = await cajaService.getCajaAbierta(user.idTenant, user.idNegocio);
      if (!abierta) {
        return NextResponse.json({ error: "No hay caja abierta" }, { status: 404 });
      }
      idCaja = abierta.id;
    }

    const data = await cajaService.getArqueo(idCaja, user.idTenant);
    return NextResponse.json({ data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    console.error("GET /api/caja/arqueo error:", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
