import { NextResponse } from "next/server";
import { withAuth, ApiError } from "@/lib/api-handler";
import { PERMISOS } from "@/lib/permisos";
import { getSupabaseServer } from "@/lib/supabase-server";
import { auditUpdate } from "@/lib/audit";
import { TipoDoc } from "@/lib/tipo-documento";

export const PUT = withAuth<{ id: string }>(
  async (req, { user, params }) => {
    const idDoc = parseInt(params.id);
    const body = await req.json();
    const { FechaEmision, Descripcion, Concepto, Total, IdMetodoPago } = body;

    const { error } = await getSupabaseServer()
      .from("Documento")
      .update(
        auditUpdate(user.id, {
          FechaEmision,
          Descripcion: Descripcion ?? null,
          Concepto: Concepto ?? null,
          Total,
          IdMetodoPago: IdMetodoPago ?? null,
        }),
      )
      .eq("id", idDoc)
      .eq("IdTenant", user.idTenant)
      .eq("IdTipoDocumento", TipoDoc.GASTO)
      .eq("Estado", 1);

    if (error) throw new ApiError(500, error.message);

    return NextResponse.json({ ok: true });
  },
  { roles: PERMISOS.CAJA_Y_GASTOS },
);
