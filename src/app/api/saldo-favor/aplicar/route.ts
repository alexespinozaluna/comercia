import { NextResponse } from "next/server";
import { withAuth, ApiError } from "@/lib/api-handler";
import { PERMISOS } from "@/lib/permisos";
import { cajaService } from "@/services/caja-service";
import { documentoService } from "@/services/documento-service";

// Consume saldo a favor de un cliente para pagar sus deudas (FIFO). No mueve
// caja: el RPC crea un Documento tipo 6 sin caja/ingreso y baja el crédito.
export const POST = withAuth(
  async (req, { user }) => {
    // Requiere caja abierta (consistente con el registro de abonos)
    const caja = await cajaService.getCajaAbierta(user.idTenant, user.idNegocio);
    if (!caja) {
      throw new ApiError(400, "No hay caja abierta");
    }

    const body = await req.json();
    const { tipo, id, FechaEmision, Concepto, Total } = body;

    if (tipo !== 1 && tipo !== 2) {
      throw new ApiError(400, "tipo inválido (1 = venta, 2 = cliente)");
    }
    if (!id || id <= 0) {
      throw new ApiError(400, "id requerido");
    }
    if (!FechaEmision) {
      throw new ApiError(400, "FechaEmision requerida");
    }
    if (Total == null || Total <= 0) {
      throw new ApiError(400, "El monto debe ser mayor a cero");
    }

    const result = await documentoService.aplicarSaldoFavor(
      tipo,
      id,
      Total,
      FechaEmision,
      Concepto ?? null,
      user.idTenant,
      user.id,
      user.idNegocio,
    );

    return NextResponse.json({ data: result });
  },
  { roles: PERMISOS.COBRANZA, exposeErrors: true },
);
