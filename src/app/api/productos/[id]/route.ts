import { NextResponse } from "next/server";
import { withAuth, ApiError } from "@/lib/api-handler";
import { PERMISOS } from "@/lib/permisos";
import { productoService } from "@/services/producto-service";
import { getSupabaseServer } from "@/lib/supabase-server";
import { auditUpdate } from "@/lib/audit";

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  const data = await productoService.getById(parseInt(params.id), user.idTenant, user.idNegocio);
  return NextResponse.json({ data });
});

export const PUT = withAuth<{ id: string }>(
  async (req, { user, params }) => {
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
      .update(auditUpdate(user.id, update))
      .eq("id", parseInt(params.id))
      .eq("IdTenant", user.idTenant)
      .eq("Estado", 1);

    if (error) throw new ApiError(500, error.message);

    return NextResponse.json({ ok: true });
  },
  { roles: PERMISOS.VENTAS_Y_CATALOGO },
);

export const DELETE = withAuth<{ id: string }>(
  async (_req, { user, params }) => {
    const productId = parseInt(params.id);

    // Verificar que no tenga movimientos en Kardex
    const { data: movimientos, error: movErr } = await getSupabaseServer()
      .from("ProductoMovimiento")
      .select("id")
      .eq("IdProducto", productId)
      .eq("IdTenant", user.idTenant)
      .limit(1);

    if (movErr) throw new ApiError(500, movErr.message);

    if (movimientos && movimientos.length > 0) {
      throw new ApiError(400, "No se puede eliminar: el producto tiene movimientos de stock");
    }

    // Soft delete
    const { error } = await getSupabaseServer()
      .from("Producto")
      .update(auditUpdate(user.id, { Estado: 0 }))
      .eq("id", productId)
      .eq("IdTenant", user.idTenant);

    if (error) throw new ApiError(500, error.message);

    return NextResponse.json({ ok: true });
  },
  { roles: PERMISOS.ADMINISTRACION },
);
