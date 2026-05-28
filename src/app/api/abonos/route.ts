import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, requireRole } from "@/lib/api-auth";
import { cajaService } from "@/services/caja-service";
import { documentoService } from "@/services/documento-service";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    requireRole(user, ["ADMIN", "CAJERO", "COBRANZA", "SUPERVISOR"]);

    // Validar caja abierta
    const caja = await cajaService.getCajaAbierta(user.idTenant);
    if (!caja) {
      return NextResponse.json({ error: "No hay caja abierta" }, { status: 400 });
    }

    const body = await req.json();
    const { tipo, id, FechaEmision, Concepto, Total, IdMetodoPago } = body;

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
    );

    // Vincular los abonos creados (1..N) con la caja activa, para arqueo.
    if (result?.abonos?.length) {
      await documentoService.setIdCaja(result.abonos, caja.id, user.idTenant);
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    // Surface RPC business errors (p.ej. "El monto ingresado es mayor a la deuda")
    const msg = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
