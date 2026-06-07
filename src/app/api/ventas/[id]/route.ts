import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, requireRole } from "@/lib/api-auth";
import { documentoService } from "@/services/documento-service";
import { cajaService } from "@/services/caja-service";
import { getSupabaseServer } from "@/lib/supabase-server";
import { auditUpdate } from "@/lib/audit";
import { TipoDoc } from "@/lib/tipo-documento";

const MAX_FIELD_LEN = 500;

function truncateField(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_FIELD_LEN ? trimmed.substring(0, MAX_FIELD_LEN) : trimmed;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const data = await documentoService.getVentaConItem(parseInt(id), user.idTenant, user.idNegocio);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/ventas/[id] error:", err);
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
    const idDoc = parseInt(id);

    const body = await req.json();
    const { FechaEmision, Descripcion, Concepto, Total, bCredito, IdCliente, IdClienteDireccion, DireccionEntrega, IdMetodoPago, DocumentoItem: items, originalItemIds } = body;

    const doc = {
      FechaEmision,
      Descripcion: truncateField(Descripcion),
      Concepto: truncateField(Concepto),
      Total,
      bCredito: !!bCredito,
      IdCliente: IdCliente && IdCliente !== 0 ? IdCliente : null,
      IdClienteDireccion: IdClienteDireccion ?? null,
      DireccionEntrega: DireccionEntrega ?? null,
      Saldo: bCredito ? Total : 0,
      IdMetodoPago: IdMetodoPago ?? null,
    };

    // Nuevo (id 0 o invalido) → crear; existente (id > 0) → modificar
    const isNew = !idDoc || idDoc <= 0;

    let cajaActiva: { id: number } | null = null;
    if (isNew) {
      // Crear requiere caja abierta (igual que POST /api/ventas)
      cajaActiva = await cajaService.getCajaAbierta(user.idTenant, user.idNegocio);
      if (!cajaActiva) {
        return NextResponse.json({ error: "No hay caja abierta" }, { status: 400 });
      }
    } else {
      // Verify document exists, is active, belongs to tenant, and has no payments
      const { data: existing, error: fetchErr } = await getSupabaseServer()
        .from("Documento")
        .select("id, Estado, IdTenant, TotalAbono")
        .eq("id", idDoc)
        .single();

      if (fetchErr || !existing) {
        return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
      }

      if ((existing as { Estado: number }).Estado !== 1) {
        return NextResponse.json({ error: "Este documento no se puede modificar" }, { status: 403 });
      }

      if ((existing as { IdTenant: number }).IdTenant !== user.idTenant) {
        return NextResponse.json({ error: "No tiene permiso para modificar este documento" }, { status: 403 });
      }

      if ((existing as { TotalAbono: number }).TotalAbono > 0) {
        return NextResponse.json({ error: "No se puede modificar: el documento ya tiene abonos registrados" }, { status: 403 });
      }
    }

    const result = await documentoService.guardarVentaConItems(
      isNew ? 0 : idDoc,
      { ...doc, IdTipoDocumento: TipoDoc.VENTA },
      items ?? [],
      originalItemIds ?? [],
      user.idTenant,
      user.id,
      user.idNegocio,
    );

    // Vincular venta nueva a la caja activa (para arqueo).
    if (isNew && cajaActiva && result?.id) {
      await documentoService.setIdCaja(result.id, cajaActiva.id, user.idTenant, user.id);
      result.IdCaja = cajaActiva.id;
    }

    return NextResponse.json(isNew ? { data: result } : { ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const clientMsg = msg.includes("Descuadre de totales")
      ? "error: al conectarse al servidor"
      : msg;
    return NextResponse.json({ error: clientMsg }, { status: 400 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    requireRole(user, ["ADMIN", "SUPERVISOR"]);

    const { id } = await params;
    const idDoc = parseInt(id);

    // Verify document exists and is deleted
    const { data: doc, error: docErr } = await getSupabaseServer()
      .from("Documento")
      .select("id")
      .eq("id", idDoc)
      .eq("IdTenant", user.idTenant)
      .eq("Estado", 0)
      .single();

    if (docErr || !doc) {
      return NextResponse.json({ error: "Documento no encontrado o ya esta activo" }, { status: 404 });
    }

    // Restore items
    const { error: itemErr } = await getSupabaseServer()
      .from("DocumentoItem")
      .update(auditUpdate(user.id, { Estado: 1 }))
      .eq("IdDocumento", idDoc)
      .eq("IdTenant", user.idTenant);

    if (itemErr) {
      console.error("POST restore items error:", itemErr);
    }

    // Restore document
    const { error } = await getSupabaseServer()
      .from("Documento")
      .update(auditUpdate(user.id, { Estado: 1 }))
      .eq("id", idDoc)
      .eq("IdTenant", user.idTenant);

    if (error) {
      console.error("POST restore error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const clientMsg = msg.includes("Descuadre de totales")
      ? "error: al conectarse al servidor"
      : msg;
    return NextResponse.json({ error: clientMsg }, { status: 400 });
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
    const idDoc = parseInt(id);

    // Verify no payments
    const { data: doc, error: docErr } = await getSupabaseServer()
      .from("Documento")
      .select("TotalAbono")
      .eq("id", idDoc)
      .eq("IdTenant", user.idTenant)
      .eq("Estado", 1)
      .single();

    if (docErr || !doc) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    if ((doc as { TotalAbono: number }).TotalAbono > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar: el documento tiene abonos registrados" },
        { status: 400 }
      );
    }

    // Soft delete items
    const { error: itemDelErr } = await getSupabaseServer()
      .from("DocumentoItem")
      .update(auditUpdate(user.id, { Estado: 0 }))
      .eq("IdDocumento", idDoc)
      .eq("IdTenant", user.idTenant);

    if (itemDelErr) {
      console.error("DELETE /api/ventas/[id] items error:", itemDelErr);
    }

    // Soft delete document
    const { error } = await getSupabaseServer()
      .from("Documento")
      .update(auditUpdate(user.id, { Estado: 0 }))
      .eq("id", idDoc)
      .eq("IdTenant", user.idTenant);

    if (error) {
      console.error("DELETE /api/ventas/[id] error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/ventas/[id] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}