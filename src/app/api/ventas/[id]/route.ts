import { NextResponse } from "next/server";
import { withAuth, ApiError } from "@/lib/api-handler";
import { PERMISOS } from "@/lib/permisos";
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

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  const data = await documentoService.getVentaConItem(parseInt(params.id), user.idTenant, user.idNegocio);
  return NextResponse.json({ data });
});

export const PUT = withAuth<{ id: string }>(
  async (req, { user, params }) => {
    const idDoc = parseInt(params.id);

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
        throw new ApiError(400, "No hay caja abierta");
      }
    } else {
      // Verify document exists, is active, belongs to tenant, and has no payments
      const { data: existing, error: fetchErr } = await getSupabaseServer()
        .from("Documento")
        .select("id, Estado, IdTenant, TotalAbono, IdTipoDocumento")
        .eq("id", idDoc)
        .single();

      if (fetchErr || !existing) {
        throw new ApiError(404, "Documento no encontrado");
      }

      // Solo se editan ventas por esta vía. Editar otro tipo (p. ej. un ajuste,
      // tipo 5) lo reescribiría como venta — bloquear.
      if ((existing as { IdTipoDocumento: number }).IdTipoDocumento !== TipoDoc.VENTA) {
        throw new ApiError(403, "Este documento no es una venta y no se puede editar aquí");
      }

      if ((existing as { Estado: number }).Estado !== 1) {
        throw new ApiError(403, "Este documento no se puede modificar");
      }

      if ((existing as { IdTenant: number }).IdTenant !== user.idTenant) {
        throw new ApiError(403, "No tiene permiso para modificar este documento");
      }

      if ((existing as { TotalAbono: number }).TotalAbono > 0) {
        throw new ApiError(403, "No se puede modificar: el documento ya tiene abonos registrados");
      }
    }

    let result;
    try {
      result = await documentoService.guardarVentaConItems(
        isNew ? 0 : idDoc,
        { ...doc, IdTipoDocumento: TipoDoc.VENTA },
        items ?? [],
        originalItemIds ?? [],
        user.idTenant,
        user.id,
        user.idNegocio,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ApiError(
        400,
        msg.includes("Descuadre de totales") ? "error: al conectarse al servidor" : msg,
      );
    }

    // Vincular venta nueva a la caja activa (para arqueo).
    if (isNew && cajaActiva && result?.id) {
      await documentoService.setIdCaja(result.id, cajaActiva.id, user.idTenant, user.id);
      result.IdCaja = cajaActiva.id;
    }

    return NextResponse.json(isNew ? { data: result } : { ok: true });
  },
  { roles: PERMISOS.VENTAS_Y_CATALOGO },
);

export const POST = withAuth<{ id: string }>(
  async (_req, { user, params }) => {
    const idDoc = parseInt(params.id);

    // Verify document exists and is deleted
    const { data: doc, error: docErr } = await getSupabaseServer()
      .from("Documento")
      .select("id")
      .eq("id", idDoc)
      .eq("IdTenant", user.idTenant)
      .eq("Estado", 0)
      .single();

    if (docErr || !doc) {
      throw new ApiError(404, "Documento no encontrado o ya esta activo");
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

    if (error) throw new ApiError(500, error.message);

    return NextResponse.json({ ok: true });
  },
  { roles: PERMISOS.ADMINISTRACION, exposeErrors: true },
);

export const DELETE = withAuth<{ id: string }>(
  async (_req, { user, params }) => {
    const idDoc = parseInt(params.id);

    // Verify no payments
    const { data: doc, error: docErr } = await getSupabaseServer()
      .from("Documento")
      .select("TotalAbono, IdTipoDocumento")
      .eq("id", idDoc)
      .eq("IdTenant", user.idTenant)
      .eq("Estado", 1)
      .single();

    if (docErr || !doc) {
      throw new ApiError(404, "Documento no encontrado");
    }

    // Los ajustes (tipo 5) se anulan desde el módulo de Stock, no aquí: por esta
    // vía no se devolvería el stock correctamente.
    if ((doc as { IdTipoDocumento: number }).IdTipoDocumento === TipoDoc.AJUSTE) {
      throw new ApiError(400, "Los ajustes de inventario se anulan desde Stock → Ajustes");
    }

    if ((doc as { TotalAbono: number }).TotalAbono > 0) {
      throw new ApiError(400, "No se puede eliminar: el documento tiene abonos registrados");
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

    if (error) throw new ApiError(500, error.message);

    return NextResponse.json({ ok: true });
  },
  { roles: PERMISOS.ADMINISTRACION },
);
