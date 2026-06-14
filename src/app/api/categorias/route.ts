import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, requireRole } from "@/lib/api-auth";
import { PERMISOS } from "@/lib/permisos";
import { categoriaService } from "@/services/categoria-service";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const data = await categoriaService.getAll(user.idTenant);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/categorias error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    requireRole(user, PERMISOS.VENTAS_Y_CATALOGO);

    const { Nombre } = await req.json();
    if (!Nombre || !String(Nombre).trim()) {
      return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
    }

    const data = await categoriaService.create(user.idTenant, String(Nombre), user.id);
    return NextResponse.json({ data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    const status = msg === "Forbidden" ? 403 : 400;
    console.error("POST /api/categorias error:", err);
    return NextResponse.json({ error: msg }, { status });
  }
}
