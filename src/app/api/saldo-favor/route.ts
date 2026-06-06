import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, requireRole } from "@/lib/api-auth";
import { cajaService } from "@/services/caja-service";
import { getSupabaseServer } from "@/lib/supabase-server";
import { auditCreate } from "@/lib/audit";

// Registra un saldo a favor (anticipo) de un cliente: un Documento tipo 4 con
// Saldo = Total (= crédito disponible). No toca deudas. Es dinero recibido →
// se vincula a la caja activa para el arqueo, igual que un abono/gasto.
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    requireRole(user, ["ADMIN", "CAJERO", "COBRANZA", "SUPERVISOR"]);

    // Validar caja abierta (de la sucursal activa)
    const caja = await cajaService.getCajaAbierta(user.idTenant, user.idNegocio);
    if (!caja) {
      return NextResponse.json({ error: "No hay caja abierta" }, { status: 400 });
    }

    const body = await req.json();
    const { IdCliente, FechaEmision, Concepto, Total, IdMetodoPago } = body;

    if (!IdCliente || IdCliente <= 0) {
      return NextResponse.json({ error: "Cliente requerido" }, { status: 400 });
    }
    if (!FechaEmision || Total == null || Total <= 0) {
      return NextResponse.json({ error: "FechaEmision y monto requeridos" }, { status: 400 });
    }

    const { data, error } = await getSupabaseServer()
      .from("Documento")
      .insert(
        auditCreate(user.id, {
          FechaEmision,
          Descripcion: Concepto ?? "Saldo a favor",
          Concepto: Concepto ?? "Saldo a favor",
          Total,
          bCredito: false,
          IdCliente,
          IdClienteDireccion: null,
          DireccionEntrega: null,
          TotalAbono: 0,
          IdTipoDocumento: 4, // saldo a favor
          Saldo: Total, // crédito disponible (Fase 2: se consume)
          IdMetodoPago: IdMetodoPago ?? null,
          IdCaja: caja.id,
          IdTenant: user.idTenant,
          IdNegocio: user.idNegocio,
          Estado: 1,
        }),
      )
      .select()
      .single();

    if (error) {
      console.error("POST /api/saldo-favor error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("POST /api/saldo-favor error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
