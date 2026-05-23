import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, requireRole } from "@/lib/api-auth";
import { cajaService } from "@/services/caja-service";
import { getSupabaseServer } from "@/lib/supabase-server";
import { Documento, DocumentoItem } from "@/types/database";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    requireRole(user, ["ADMIN", "CAJERO", "COBRANZA", "SUPERVISOR"]);

    // Validar caja abierta
    const caja = await cajaService.getCajaAbierta(user.idTenant);
    if (!caja) {
      return NextResponse.json({ error: "No hay caja abierta" }, { status: 400 });
    }

    const body = await req.json();
    const { FechaEmision, Concepto, Total, IdCliente, IdMetodoPago, DocumentoItem: items } = body;

    if (!FechaEmision || Total == null || Total <= 0) {
      return NextResponse.json({ error: "FechaEmision y Total requeridos" }, { status: 400 });
    }

    let idReturn = 0;
    try {
      const docData = {
        FechaEmision,
        Descripcion: null,
        Concepto: Concepto ?? "Abono",
        Total,
        bCredito: false,
        IdCliente: IdCliente && IdCliente !== 0 ? IdCliente : null,
        IdClienteDireccion: null,
        DireccionEntrega: null,
        TotalAbono: 0,
        IdTipoDocumento: 2,
        Saldo: 0,
        IdMetodoPago: IdMetodoPago ?? null,
        IdTenant: user.idTenant,
        Estado: 1,
        IdUsuarioCreacion: user.id,
      };

      const { data: insertedDoc, error: docErr } = await getSupabaseServer()
        .from("Documento")
        .insert(docData)
        .select()
        .single();

      if (docErr || !insertedDoc) {
        console.error("POST /api/abonos insert doc error:", docErr);
        return NextResponse.json({ error: docErr?.message || "Error creando abono" }, { status: 500 });
      }

      idReturn = (insertedDoc as Documento).id;

      if (items && items.length > 0) {
        const itemsToInsert = items.map((item: DocumentoItem) => ({
          IdProducto: 0,
          Descripcion: item.Descripcion,
          Cantidad: 1,
          PrecioVenta: item.PrecioVenta,
          MontoAbono: item.MontoAbono ?? item.PrecioVenta,
          Total: item.Total ?? item.PrecioVenta,
          IdDocumento: idReturn,
          IdDocumentoRef: item.IdDocumentoRef ?? null,
          IdTenant: user.idTenant,
          Estado: 1,
        }));

        const { error: itemErr } = await getSupabaseServer().from("DocumentoItem").insert(itemsToInsert);
        if (itemErr) {
          console.error("POST /api/abonos insert items error:", itemErr);
          try { await getSupabaseServer().from("Documento").delete().eq("id", idReturn).eq("IdTenant", user.idTenant); } catch {}
          return NextResponse.json({ error: itemErr.message }, { status: 500 });
        }
      }

      return NextResponse.json({ data: insertedDoc });
    } catch (ex) {
      if (idReturn > 0) {
        try { await getSupabaseServer().from("Documento").delete().eq("id", idReturn).eq("IdTenant", user.idTenant); } catch {}
      }
      throw ex;
    }
  } catch (err) {
    console.error("POST /api/abonos error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
