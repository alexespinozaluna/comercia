import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, requireRole } from "@/lib/api-auth";
import { productoService } from "@/services/producto-service";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const data = await productoService.getById(parseInt(id), user.idTenant);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/productos/[id] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    requireRole(user, ["ADMIN", "CAJERO", "VENDEDOR", "SUPERVISOR"]);

    const { id } = await params;
    const body = await req.json();
    const { Nombre, PrecioCosto, PrecioVenta, FechaVencimiento, IdCategoria, bActivoVenta } = body;

    // Stock (Cantidad) NO se toca aquí: se gestiona vía Ajustes/Kardex.
    const update: Record<string, unknown> = {
      Nombre,
      PrecioCosto: PrecioCosto ?? null,
      PrecioVenta,
      FechaVencimiento: FechaVencimiento ?? null,
    };
    if (IdCategoria != null) update.IdCategoria = IdCategoria;
    if (bActivoVenta != null) update.bActivoVenta = bActivoVenta;

    const { error } = await getSupabaseServer()
      .from("Producto")
      .update(update)
      .eq("id", parseInt(id))
      .eq("IdTenant", user.idTenant)
      .eq("Estado", 1);

    if (error) {
      console.error("PUT /api/productos/[id] error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/productos/[id] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    requireRole(user, ["ADMIN", "SUPERVISOR"]);

    const { id } = await params;
    const productId = parseInt(id);

    // Verificar que no tenga movimientos en Kardex
    const { data: movimientos, error: movErr } = await getSupabaseServer()
      .from("ProductoMovimiento")
      .select("id")
      .eq("IdProducto", productId)
      .eq("IdTenant", user.idTenant)
      .limit(1);

    if (movErr) {
      console.error("DELETE /api/productos/[id] kardex check error:", movErr);
      return NextResponse.json({ error: movErr.message }, { status: 500 });
    }

    if (movimientos && movimientos.length > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar: el producto tiene movimientos de stock" },
        { status: 400 }
      );
    }

    // Soft delete
    const { error } = await getSupabaseServer()
      .from("Producto")
      .update({ Estado: 0 })
      .eq("id", productId)
      .eq("IdTenant", user.idTenant);

    if (error) {
      console.error("DELETE /api/productos/[id] error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/productos/[id] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
