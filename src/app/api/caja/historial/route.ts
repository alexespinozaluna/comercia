import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, requireRole } from "@/lib/api-auth";
import { PERMISOS } from "@/lib/permisos";
import { cajaService } from "@/services/caja-service";

/**
 * GET /api/caja/historial?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&usuario=<id>&descuadre=1
 * Solo ADMIN / SUPERVISOR (auditoría de cierres).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    requireRole(user, PERMISOS.ADMINISTRACION);

    const sp = req.nextUrl.searchParams;
    const desde = sp.get("desde") || undefined;
    const hasta = sp.get("hasta") || undefined;
    const usuarioStr = sp.get("usuario");
    const descuadre = sp.get("descuadre") === "1";
    const limitStr = sp.get("limit");

    const idUsuario = usuarioStr ? parseInt(usuarioStr, 10) : undefined;
    const limit = limitStr ? Math.min(parseInt(limitStr, 10) || 100, 500) : 100;

    const data = await cajaService.getHistorial(user.idTenant, {
      desde,
      hasta,
      idUsuario: idUsuario && idUsuario > 0 ? idUsuario : undefined,
      soloDescuadre: descuadre,
      limit,
      idNegocio: user.idNegocio,
    });
    return NextResponse.json({ data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    const status = msg === "Forbidden" ? 403 : 400;
    console.error("GET /api/caja/historial error:", err);
    return NextResponse.json({ error: msg }, { status });
  }
}
