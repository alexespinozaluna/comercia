import { NextResponse } from "next/server";
import { withAuth, ApiError } from "@/lib/api-handler";
import { PERMISOS } from "@/lib/permisos";
import { cajaService } from "@/services/caja-service";
import { documentoService } from "@/services/documento-service";

export const POST = withAuth(
  async (req, { user }) => {
    // Validar caja abierta (de la sucursal activa)
    const caja = await cajaService.getCajaAbierta(user.idTenant, user.idNegocio);
    if (!caja) {
      throw new ApiError(400, "No hay caja abierta");
    }

    const body = await req.json();
    const { tipo, id, FechaEmision, Concepto, Total, IdMetodoPago } = body;

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

    // Distribución FIFO + validación + inserción atómica en el RPC
    const result = await documentoService.registrarAbono(
      tipo,
      id,
      Total,
      FechaEmision,
      Concepto ?? null,
      IdMetodoPago ?? null,
      user.idTenant,
      user.id,
      user.idNegocio,
    );

    // Vincular los abonos creados (1..N) con la caja activa, para arqueo.
    if (result?.abonos?.length) {
      await documentoService.setIdCaja(result.abonos, caja.id, user.idTenant, user.id);
    }

    return NextResponse.json({ data: result });
  },
  // exposeErrors: surface RPC business errors (p.ej. "El monto ingresado es mayor a la deuda")
  { roles: PERMISOS.COBRANZA, exposeErrors: true },
);
