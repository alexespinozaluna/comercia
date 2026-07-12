import { NextResponse } from "next/server";
import { withAuth, ApiError } from "@/lib/api-handler";
import { PERMISOS } from "@/lib/permisos";
import { cajaService } from "@/services/caja-service";
import { documentoService } from "@/services/documento-service";

/**
 * Corrige el método de pago de un documento (venta contado, abono, saldo a
 * favor, gasto). Update de un solo campo; no aplica a ventas a crédito (método
 * "Deuda"), ajustes ni abonos con saldo a favor. Solo con la caja del documento
 * abierta, porque re-categoriza el arqueo/reporte por método.
 */
export const PATCH = withAuth<{ id: string }>(
  async (req, { user, params }) => {
    const id = parseInt(params.id);
    if (!id || id <= 0) {
      throw new ApiError(400, "id inválido");
    }

    const body = await req.json();
    const idMetodoPago = Number(body?.IdMetodoPago);
    if (!idMetodoPago || idMetodoPago <= 0) {
      throw new ApiError(400, "IdMetodoPago requerido");
    }

    // La caja de la sucursal activa debe estar abierta.
    const caja = await cajaService.getCajaAbierta(user.idTenant, user.idNegocio);
    if (!caja) {
      throw new ApiError(400, "No hay caja abierta");
    }

    await documentoService.actualizarMetodoPago(
      id,
      idMetodoPago,
      user.idTenant,
      user.id,
      user.idNegocio,
      caja.id,
    );

    return NextResponse.json({ ok: true });
  },
  // exposeErrors: surface reglas de negocio (método inválido, no elegible, caja).
  { roles: PERMISOS.CAJA_Y_GASTOS, exposeErrors: true },
);
