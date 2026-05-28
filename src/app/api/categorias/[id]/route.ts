import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, requireRole } from "@/lib/api-auth";
import { categoriaService } from "@/services/categoria-service";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    requireRole(user, ["ADMIN", "CAJERO", "VENDEDOR", "SUPERVISOR"]);

    const { id } = await params;
    const { Nombre } = await req.json();

    await categoriaService.rename(parseInt(id, 10), user.idTenant, String(Nombre ?? ""));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    const status = msg === "Forbidden" ? 403 : 400;
    console.error("PUT /api/categorias/[id] error:", err);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    requireRole(user, ["ADMIN", "SUPERVISOR"]);

    const { id } = await params;
    await categoriaService.remove(parseInt(id, 10), user.idTenant);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    const status = msg === "Forbidden" ? 403 : 400;
    console.error("DELETE /api/categorias/[id] error:", err);
    return NextResponse.json({ error: msg }, { status });
  }
}
