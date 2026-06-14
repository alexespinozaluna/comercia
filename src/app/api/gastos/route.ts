import { NextResponse } from "next/server";
import { withAuth, ApiError } from "@/lib/api-handler";
import { PERMISOS } from "@/lib/permisos";
import { cajaService } from "@/services/caja-service";
import { getSupabaseServer } from "@/lib/supabase-server";
import { auditCreate } from "@/lib/audit";
import { TipoDoc } from "@/lib/tipo-documento";

export const POST = withAuth(
  async (req, { user }) => {
    // Validar caja abierta (de la sucursal activa)
    const caja = await cajaService.getCajaAbierta(user.idTenant, user.idNegocio);
    if (!caja) {
      throw new ApiError(400, "No hay caja abierta");
    }

    const body = await req.json();
    const { FechaEmision, Descripcion, Concepto, Total, IdMetodoPago } = body;

    if (!FechaEmision || Total == null || Total <= 0) {
      throw new ApiError(400, "FechaEmision y Total requeridos");
    }

    const { data, error } = await getSupabaseServer()
      .from("Documento")
      .insert(
        auditCreate(user.id, {
          FechaEmision,
          Descripcion: Descripcion ?? null,
          Concepto: Concepto ?? null,
          Total,
          bCredito: false,
          IdCliente: null,
          IdClienteDireccion: null,
          DireccionEntrega: null,
          TotalAbono: 0,
          IdTipoDocumento: TipoDoc.GASTO,
          Saldo: 0,
          IdMetodoPago: IdMetodoPago ?? null,
          IdCaja: caja.id,
          IdTenant: user.idTenant,
          IdNegocio: user.idNegocio,
          Estado: 1,
        }),
      )
      .select()
      .single();

    if (error) throw new ApiError(500, error.message);

    return NextResponse.json({ data });
  },
  { roles: PERMISOS.CAJA_Y_GASTOS },
);
