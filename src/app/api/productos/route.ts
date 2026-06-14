import { NextResponse } from "next/server";
import { withAuth, ApiError } from "@/lib/api-handler";
import { PERMISOS } from "@/lib/permisos";
import { productoService } from "@/services/producto-service";
import { getSupabaseServer } from "@/lib/supabase-server";
import { auditCreate } from "@/lib/audit";

export const GET = withAuth(async (req, { user }) => {
  const soloActivos = req.nextUrl.searchParams.get("activos") === "1";
  const data = await productoService.getAll(user.idTenant, soloActivos, user.idNegocio);
  return NextResponse.json({ data });
});

export const POST = withAuth(
  async (req, { user }) => {
    const body = await req.json();
    const { Nombre, PrecioCosto, PrecioVenta, Cantidad, FechaVencimiento, IdCategoria, bActivoVenta } = body;
    if (!Nombre || PrecioVenta == null) {
      throw new ApiError(400, "Nombre y PrecioVenta requeridos");
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

    if (error) throw new ApiError(500, error.message);

    return NextResponse.json({ data });
  },
  { roles: PERMISOS.VENTAS_Y_CATALOGO },
);
