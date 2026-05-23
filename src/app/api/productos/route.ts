import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, requireRole } from "@/lib/api-auth";
import { productoService } from "@/services/producto-service";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const data = await productoService.getAll(user.idTenant);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/productos error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    requireRole(user, ["ADMIN", "CAJERO", "VENDEDOR", "SUPERVISOR"]);

    const body = await req.json();
    const { Nombre, PrecioCosto, PrecioVenta, Cantidad, FechaVencimiento } = body;
    if (!Nombre || PrecioVenta == null) {
      return NextResponse.json({ error: "Nombre y PrecioVenta requeridos" }, { status: 400 });
    }

    const { data, error } = await getSupabaseServer()
      .from("Producto")
      .insert({
        Nombre,
        PrecioCosto: PrecioCosto ?? null,
        PrecioVenta,
        Cantidad: Cantidad ?? null,
        FechaVencimiento: FechaVencimiento ?? null,
        IdTenant: user.idTenant,
        Estado: 1,
      })
      .select()
      .single();

    if (error) {
      console.error("POST /api/productos error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("POST /api/productos error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
