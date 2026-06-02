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

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("Producto")
      .insert(
        auditCreate(user.id, {
          Nombre,
          PrecioCosto: PrecioCosto ?? null,
          PrecioVenta,
          Cantidad: Cantidad ?? null,
          FechaVencimiento: FechaVencimiento ?? null,
          IdCategoria: IdCategoria ?? 0,
          bActivoVenta: bActivoVenta ?? true,
          IdTenant: user.idTenant,
          Estado: 1,
        }),
      )
      .select()
      .single();

    if (error) {
      console.error("POST /api/productos error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Stock inicial → va a la sucursal activa (ProductoStock) + entrada en Kardex
    // (tipo 2 = Compra/Ingreso) para que el kardex cuadre desde el día 1.
    const cantidadInicial = Cantidad ?? 0;
    if (data?.id && cantidadInicial > 0 && user.idNegocio != null) {
      const { error: stockErr } = await supabase.from("ProductoStock").upsert(
        auditCreate(user.id, {
          IdProducto: data.id,
          IdNegocio: user.idNegocio,
          IdTenant: user.idTenant,
          Cantidad: cantidadInicial,
        }),
        { onConflict: "IdProducto,IdNegocio" },
      );
      if (stockErr) {
        console.error("POST /api/productos stock inicial error:", stockErr);
      }

      const { error: movErr } = await supabase.from("ProductoMovimiento").insert(
        auditCreate(user.id, {
          IdProducto: data.id,
          TipoMovimiento: 2, // Compra / Ingreso
          Cantidad: cantidadInicial,
          StockAnterior: 0,
          StockNuevo: cantidadInicial,
          IdDocumento: null,
          Observacion: "Stock inicial",
          Fecha: new Date().toISOString(),
          IdTenant: user.idTenant,
          IdNegocio: user.idNegocio,
        }),
      );
      if (movErr) {
        // No abortamos la creación del producto por un fallo de kardex; solo log.
        console.error("POST /api/productos kardex inicial error:", movErr);
      }
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("POST /api/productos error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
