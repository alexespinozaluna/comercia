import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, requireRole } from "@/lib/api-auth";
import { PERMISOS } from "@/lib/permisos";
import { cajaService } from "@/services/caja-service";
import { documentoService } from "@/services/documento-service";

// Editar el MONTO de un saldo a favor (tipo 4). Solo si no fue utilizado y su
// caja sigue abierta (lo refuerza el trigger trg_bloquear_caja_cerrada en DB).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    requireRole(user, PERMISOS.COBRANZA);

    const caja = await cajaService.getCajaAbierta(user.idTenant, user.idNegocio);
    if (!caja) {
      return NextResponse.json({ error: "No hay caja abierta" }, { status: 400 });
    }

    const { id } = await params;
    const idDoc = parseInt(id);
    if (!idDoc || idDoc <= 0) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }

    const body = await req.json();
    const { Total } = body;
    if (Total == null || Total <= 0) {
      return NextResponse.json({ error: "El monto debe ser mayor a cero" }, { status: 400 });
    }

    await documentoService.editarSaldoFavor(idDoc, Total, user.idTenant, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    requireRole(user, PERMISOS.COBRANZA);

    const caja = await cajaService.getCajaAbierta(user.idTenant, user.idNegocio);
    if (!caja) {
      return NextResponse.json({ error: "No hay caja abierta" }, { status: 400 });
    }

    const { id } = await params;
    const idDoc = parseInt(id);
    if (!idDoc || idDoc <= 0) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }

    await documentoService.eliminarSaldoFavor(idDoc, user.idTenant);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
