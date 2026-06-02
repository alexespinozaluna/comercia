import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, requireRole } from "@/lib/api-auth";
import { getSupabaseServer } from "@/lib/supabase-server";
import { auditUpdate } from "@/lib/audit";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    requireRole(user, ["ADMIN", "CAJERO", "SUPERVISOR"]);

    const { id } = await params;
    const idDoc = parseInt(id);
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
      .eq("IdTipoDocumento", 3)
      .eq("Estado", 1);

    if (error) {
      console.error("PUT /api/gastos/[id] error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/gastos/[id] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
