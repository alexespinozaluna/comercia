import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, requireRole } from "@/lib/api-auth";
import { negocioService } from "@/services/negocio-service";

// GET: lista de negocios (sucursales) del tenant. Accesible a cualquier
// usuario autenticado (el selector de sucursal lo necesita).
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const data = await negocioService.listByTenant(user.idTenant);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/negocio error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PUT: edita los datos de un negocio del tenant (ADMIN/SUPERVISOR).
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    requireRole(user, ["ADMIN", "SUPERVISOR"]);

    const body = await req.json();
    const { id, Nombre, Direccion, Telefono, Logo } = body;
    if (!id) {
      return NextResponse.json({ error: "id requerido" }, { status: 400 });
    }
    const ok = await negocioService.update(id, user.idTenant, {
      Nombre: Nombre ?? null,
      Direccion: Direccion ?? null,
      Telefono: Telefono ?? null,
      Logo: Logo ?? null,
    });
    return NextResponse.json({ ok });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
