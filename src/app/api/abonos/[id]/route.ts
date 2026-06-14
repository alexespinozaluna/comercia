import { NextResponse } from "next/server";
import { withAuth, ApiError } from "@/lib/api-handler";
import { PERMISOS } from "@/lib/permisos";
import { documentoService } from "@/services/documento-service";

export const PUT = withAuth<{ id: string }>(
  async (req, { user, params }) => {
    const idAbono = parseInt(params.id);
    if (!idAbono || idAbono <= 0) {
      throw new ApiError(400, "id inválido");
    }

    const body = await req.json();
    const { FechaEmision, Concepto, Total, IdMetodoPago } = body;

    if (!FechaEmision) {
      throw new ApiError(400, "FechaEmision requerida");
    }
    if (Total == null || Total <= 0) {
      throw new ApiError(400, "El monto debe ser mayor a cero");
    }

    const result = await documentoService.modificarAbono(
      idAbono,
      Total,
      FechaEmision,
      Concepto ?? null,
      IdMetodoPago ?? null,
      user.idTenant,
      user.id,
    );

    return NextResponse.json({ data: result });
  },
  // exposeErrors: surface RPC business errors (p.ej. "El monto ingresado es mayor a la deuda")
  { roles: PERMISOS.COBRANZA, exposeErrors: true },
);

export const DELETE = withAuth<{ id: string }>(
  async (_req, { user, params }) => {
    const idAbono = parseInt(params.id);
    if (!idAbono || idAbono <= 0) {
      throw new ApiError(400, "id inválido");
    }

    // Borrado físico: la cascada del FK y el trigger restauran el Saldo de la venta
    await documentoService.eliminarAbono(idAbono, user.idTenant);

    return NextResponse.json({ ok: true });
  },
  { roles: PERMISOS.COBRANZA, exposeErrors: true },
);
