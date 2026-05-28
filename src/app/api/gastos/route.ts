import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, requireRole } from "@/lib/api-auth";
import { cajaService } from "@/services/caja-service";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    requireRole(user, ["ADMIN", "CAJERO", "SUPERVISOR"]);

    // Validar caja abierta
    const caja = await cajaService.getCajaAbierta(user.idTenant);
    if (!caja) {
      return NextResponse.json({ error: "No hay caja abierta" }, { status: 400 });
    }

    const body = await req.json();
    const { FechaEmision, Descripcion, Concepto, Total, IdMetodoPago } = body;

    if (!FechaEmision || Total == null || Total <= 0) {
      return NextResponse.json({ error: "FechaEmision y Total requeridos" }, { status: 400 });
    }

    const { data, error } = await getSupabaseServer()
      .from("Documento")
      .insert({
        FechaEmision,
        Descripcion: Descripcion ?? null,
        Concepto: Concepto ?? null,
        Total,
        bCredito: false,
        IdCliente: null,
        IdClienteDireccion: null,
        DireccionEntrega: null,
        TotalAbono: 0,
        IdTipoDocumento: 3,
        Saldo: 0,
        IdMetodoPago: IdMetodoPago ?? null,
        IdCaja: caja.id,
        IdTenant: user.idTenant,
        Estado: 1,
        IdUsuarioCreacion: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("POST /api/gastos error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("POST /api/gastos error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
