import { NextResponse } from "next/server";
import { withAuth, ApiError } from "@/lib/api-handler";
import { PERMISOS } from "@/lib/permisos";
import { cajaService } from "@/services/caja-service";

export const POST = withAuth(
  async (req, { user }) => {
    const body = await req.json();
    const montoInicial = parseFloat(body.montoInicial);

    if (!Number.isFinite(montoInicial) || montoInicial < 0) {
      throw new ApiError(400, "MontoInicial inválido");
    }

    const existente = await cajaService.getCajaAbierta(user.idTenant, user.idNegocio);
    if (existente) {
      throw new ApiError(400, "Ya existe una caja abierta");
    }

    const data = await cajaService.abrirCaja(user.idTenant, user.id, montoInicial, user.idNegocio);
    return NextResponse.json({ data });
  },
  { roles: PERMISOS.CAJA_Y_GASTOS, exposeErrors: true },
);
