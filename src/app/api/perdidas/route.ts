import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/api-auth";
import { getSupabaseServer } from "@/lib/supabase-server";
import { TipoDoc } from "@/lib/tipo-documento";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const url = new URL(req.url);
    const fechaInicio = url.searchParams.get("fechaInicio");
    const fechaFin = url.searchParams.get("fechaFin");

    // Get losses: Documento where IdTipoDocumento = AJUSTE (Ajuste/Baja)
    let docQuery = supabase
      .from("Documento")
      .select("id, Concepto, Total, FechaEmision, DocumentoItem(Cantidad, PrecioVenta, Descripcion, IdProducto)")
      .eq("IdTipoDocumento", TipoDoc.AJUSTE)
      .eq("IdTenant", user.idTenant)
      .eq("Estado", 1);

    if (fechaInicio) docQuery = docQuery.gte("FechaEmision", fechaInicio);
    if (fechaFin) docQuery = docQuery.lte("FechaEmision", fechaFin);

    const { data: documentos, error: docError } = await docQuery;
    if (docError) {
      console.error("GET /api/perdidas doc error:", docError);
      return NextResponse.json({ error: docError.message }, { status: 500 });
    }

    // Group losses by Concepto (motivo)
    const porMotivo: Record<string, { count: number; total: number }> = {};
    let totalPerdida = 0;
    const items: {
      id: number;
      motivo: string;
      fecha: string;
      producto: string;
      cantidad: number;
      precioUnitario: number;
      total: number;
    }[] = [];

    for (const doc of documentos ?? []) {
      const motivo = doc.Concepto ?? "Sin motivo";
      if (!porMotivo[motivo]) {
        porMotivo[motivo] = { count: 0, total: 0 };
      }

      const docItems = doc.DocumentoItem as unknown as {
        Cantidad: number;
        PrecioVenta: number;
        Descripcion: string;
        IdProducto: number;
      }[];

      if (Array.isArray(docItems)) {
        for (const item of docItems) {
          const itemTotal = item.Cantidad * item.PrecioVenta;
          porMotivo[motivo].count += 1;
          porMotivo[motivo].total += itemTotal;
          totalPerdida += itemTotal;

          items.push({
            id: doc.id,
            motivo,
            fecha: doc.FechaEmision,
            producto: item.Descripcion,
            cantidad: item.Cantidad,
            precioUnitario: item.PrecioVenta,
            total: itemTotal,
          });
        }
      } else {
        // Document with no items (shouldn't happen, but handle)
        porMotivo[motivo].count += 1;
        porMotivo[motivo].total += doc.Total;
        totalPerdida += doc.Total;
      }
    }

    // Get products expiring within 7 days
    const today = new Date();
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const todayStr = today.toISOString().split("T")[0];
    const futureStr = sevenDaysFromNow.toISOString().split("T")[0];

    const { data: proxVencer, error: vencerError } = await supabase
      .from("Producto")
      .select("id, Nombre, PrecioVenta, PrecioCosto, Cantidad, FechaVencimiento")
      .eq("IdTenant", user.idTenant)
      .eq("Estado", 1)
      .not("FechaVencimiento", "is", null)
      .gte("FechaVencimiento", todayStr)
      .lte("FechaVencimiento", futureStr);

    if (vencerError) {
      console.error("GET /api/perdidas vencer error:", vencerError);
      // Don't fail the whole request, just return empty alerts
    }

    // Get products already expired
    const { data: vencidos, error: vencidosError } = await supabase
      .from("Producto")
      .select("id, Nombre, PrecioVenta, PrecioCosto, Cantidad, FechaVencimiento")
      .eq("IdTenant", user.idTenant)
      .eq("Estado", 1)
      .not("FechaVencimiento", "is", null)
      .lt("FechaVencimiento", todayStr);

    if (vencidosError) {
      console.error("GET /api/perdidas vencidos error:", vencidosError);
    }

    return NextResponse.json({
      porMotivo,
      totalPerdida,
      items: items.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
      proxVencer: (proxVencer ?? []) as {
        id: number;
        Nombre: string;
        PrecioVenta: number;
        PrecioCosto: number | null;
        Cantidad: number | null;
        FechaVencimiento: string;
      }[],
      vencidos: (vencidos ?? []) as {
        id: number;
        Nombre: string;
        PrecioVenta: number;
        PrecioCosto: number | null;
        Cantidad: number | null;
        FechaVencimiento: string;
      }[],
    });
  } catch (err) {
    console.error("GET /api/perdidas error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}