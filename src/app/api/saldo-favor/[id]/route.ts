import { NextResponse } from "next/server";
import { withAuth, ApiError } from "@/lib/api-handler";
import { PERMISOS } from "@/lib/permisos";
import { cajaService } from "@/services/caja-service";
import { documentoService } from "@/services/documento-service";

// Editar el MONTO de un saldo a favor (tipo 4). Solo si no fue utilizado y su
// caja sigue abierta (lo refuerza el trigger trg_bloquear_caja_cerrada en DB).
export const PUT = withAuth<{ id: string }>(
  async (req, { user, params }) => {
    const caja = await cajaService.getCajaAbierta(user.idTenant, user.idNegocio);
    if (!caja) {
      throw new ApiError(400, "No hay caja abierta");
    }

    const idDoc = parseInt(params.id);
    if (!idDoc || idDoc <= 0) {
      throw new ApiError(400, "id inválido");
    }

    const body = await req.json();
    const { Total } = body;
    if (Total == null || Total <= 0) {
      throw new ApiError(400, "El monto debe ser mayor a cero");
    }

    await documentoService.editarSaldoFavor(idDoc, Total, user.idTenant, user.id);
    return NextResponse.json({ ok: true });
  },
  { roles: PERMISOS.COBRANZA, exposeErrors: true },
);

export const DELETE = withAuth<{ id: string }>(
  async (_req, { user, params }) => {
    const caja = await cajaService.getCajaAbierta(user.idTenant, user.idNegocio);
    if (!caja) {
      throw new ApiError(400, "No hay caja abierta");
    }

    const idDoc = parseInt(params.id);
    if (!idDoc || idDoc <= 0) {
      throw new ApiError(400, "id inválido");
    }

    await documentoService.eliminarSaldoFavor(idDoc, user.idTenant);
    return NextResponse.json({ ok: true });
  },
  { roles: PERMISOS.COBRANZA, exposeErrors: true },
);
