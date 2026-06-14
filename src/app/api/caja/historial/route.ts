import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { PERMISOS } from "@/lib/permisos";
import { cajaService } from "@/services/caja-service";

/**
 * GET /api/caja/historial?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&usuario=<id>&descuadre=1
 * Solo ADMIN / SUPERVISOR (auditoría de cierres).
 */
export const GET = withAuth(
  async (req, { user }) => {
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
  },
  { roles: PERMISOS.ADMINISTRACION },
);
