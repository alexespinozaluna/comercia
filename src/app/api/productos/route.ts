import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, requireRole } from "@/lib/api-auth";
import { productoService } from "@/services/producto-service";
import { getSupabaseServer } from "@/lib/supabase-server";
import { auditCreate } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const soloActivos = req.nextUrl.searchParams.get("activos") === "1";
    const data = await productoService.getAll(user.idTenant, soloActivos, user.idNegocio);
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
    const { Nombre, PrecioCosto, PrecioVenta, Cantidad, FechaVencimiento, IdCategoria, bActivoVenta } = body;
    if (!Nombre || PrecioVenta == null) {
      return NextResponse.json({ error: "Nombre y PrecioVenta requeridos" }, { status: 400 });
    }

    // Producto + stock inicial de la sucursal + kardex (tipo 2 = Compra/
    // Ingreso) en una sola transacción (RPC): o se crea todo o nada.
    const { data, error } = await getSupabaseServer().rpc("guardar_producto_con_kardex", {
      p_producto: auditCreate(user.id, {
        Nombre,
        PrecioCosto: PrecioCosto ?? null,
        PrecioVenta,
        Cantidad: Cantidad ?? null,
        FechaVencimiento: FechaVencimiento ?? null,
        IdCategoria: IdCategoria ?? 0,
        bActivoVenta: bActivoVenta ?? true,
      }),
      p_id_tenant: user.idTenant,
      p_id_negocio: user.idNegocio ?? null,
    });

    if (error) {
      console.error("POST /api/productos rpc error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("POST /api/productos error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
