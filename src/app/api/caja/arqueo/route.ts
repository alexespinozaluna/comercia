import { NextResponse } from "next/server";
import { withAuth, ApiError } from "@/lib/api-handler";
import { cajaService } from "@/services/caja-service";

/**
 * GET /api/caja/arqueo?id=<idCaja>
 *
 * Si se omite `id`, intenta usar la caja abierta del tenant.
 * Devuelve el desglose vivo (no persistido) calculado por fn_caja_arqueo:
 * inicial + ventas efectivo + abonos efectivo − gastos efectivo = esperado.
 */
export const GET = withAuth(
  async (req, { user }) => {
    const idParam = req.nextUrl.searchParams.get("id");
    let idCaja: number | null = idParam ? parseInt(idParam, 10) : null;

    if (!idCaja || !Number.isFinite(idCaja) || idCaja <= 0) {
      const abierta = await cajaService.getCajaAbierta(user.idTenant, user.idNegocio);
      if (!abierta) {
        throw new ApiError(404, "No hay caja abierta");
      }
      idCaja = abierta.id;
    }

    const data = await cajaService.getArqueo(idCaja, user.idTenant);
    return NextResponse.json({ data });
  },
  { exposeErrors: true },
);
