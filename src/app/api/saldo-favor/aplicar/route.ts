import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, requireRole } from "@/lib/api-auth";
import { PERMISOS } from "@/lib/permisos";
import { cajaService } from "@/services/caja-service";
import { documentoService } from "@/services/documento-service";

// Consume saldo a favor de un cliente para pagar sus deudas (FIFO). No mueve
// caja: el RPC crea un Documento tipo 6 sin caja/ingreso y baja el crédito.
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    requireRole(user, PERMISOS.COBRANZA);

    // Requiere caja abierta (consistente con el registro de abonos)
    const caja = await cajaService.getCajaAbierta(user.idTenant, user.idNegocio);
    if (!caja) {
      return NextResponse.json({ error: "No hay caja abierta" }, { status: 400 });
    }

    const body = await req.json();
    const { tipo, id, FechaEmision, Concepto, Total } = body;

    if (tipo !== 1 && tipo !== 2) {
      return NextResponse.json({ error: "tipo inválido (1 = venta, 2 = cliente)" }, { status: 400 });
    }
    if (!id || id <= 0) {
      return NextResponse.json({ error: "id requerido" }, { status: 400 });
    }
    if (!FechaEmision) {
      return NextResponse.json({ error: "FechaEmision requerida" }, { status: 400 });
    }
    if (Total == null || Total <= 0) {
      return NextResponse.json({ error: "El monto debe ser mayor a cero" }, { status: 400 });
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
