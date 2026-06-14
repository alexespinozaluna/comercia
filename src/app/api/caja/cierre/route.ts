import { NextResponse } from "next/server";
import { withAuth, ApiError } from "@/lib/api-handler";
import { PERMISOS } from "@/lib/permisos";
import { cajaService } from "@/services/caja-service";

export const POST = withAuth(
  async (req, { user }) => {
    const body = await req.json();
    const id = parseInt(body.id, 10);
    const montoFinal = parseFloat(body.montoFinal);
    const observacion: string | null =
      typeof body.observacion === "string" ? body.observacion.trim() || null : null;

    if (!Number.isFinite(id) || id <= 0) {
      throw new ApiError(400, "id inválido");
    }
    if (!Number.isFinite(montoFinal) || montoFinal < 0) {
      throw new ApiError(400, "MontoFinal inválido");
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
  },
  { roles: PERMISOS.CAJA_Y_GASTOS, exposeErrors: true },
);
