import { Documento, DocumentoItem, MetodoPago, ClienteDireccion } from "@/types/database";
import { getSupabaseServer } from "@/lib/supabase-server";
import { deleteItem } from "./supabase-service";

const TABLE = "Documento";
const TABLE_ITEM = "DocumentoItem";
const MAX_FIELD_LEN = 500;

/** Truncate a string to MAX_FIELD_LEN, return null if empty/null */
function truncateField(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_FIELD_LEN ? trimmed.substring(0, MAX_FIELD_LEN) : trimmed;
}

/** Build a clean JSONB object from a Documento for RPC calls (strips nested relations and id=0) */
function buildDocumentoJson(doc: Partial<Documento> & { FechaEmision: string; Total: number; bCredito: boolean }): Record<string, unknown> {
  return {
    FechaEmision: doc.FechaEmision,
    Descripcion: truncateField(doc.Descripcion),
    Concepto: truncateField(doc.Concepto),
    Total: doc.Total,
    bCredito: doc.bCredito,
    IdCliente: doc.IdCliente && doc.IdCliente !== 0 ? doc.IdCliente : null,
    IdClienteDireccion: doc.IdClienteDireccion ?? null,
    DireccionEntrega: doc.DireccionEntrega ?? null,
    IdTipoDocumento: doc.IdTipoDocumento ?? 1,
    Saldo: doc.bCredito ? doc.Total : 0,
    IdMetodoPago: doc.IdMetodoPago ?? null,
  };
}

/** Build a clean JSONB array from DocumentoItem[] for RPC calls */
function buildItemsJson(items: DocumentoItem[]): Record<string, unknown>[] {
  return items.map((item) => ({
    IdProducto: item.IdProducto,
    Descripcion: item.Descripcion,
    Cantidad: item.Cantidad,
    PrecioVenta: item.PrecioVenta,
    MontoAbono: item.MontoAbono ?? 0,
    Total: item.Total ?? item.Cantidad * item.PrecioVenta,
    IdDocumentoRef: item.IdDocumentoRef ?? null,
  }));
}

export const documentoService = {
  /** Get filtered sales list with client join */
  async getVentas(
    fechaIni: string,
    fechaFin: string,
    bCredito = false,
    idCliente = 0,
    tenantId?: number
  ): Promise<Documento[]> {
    let query = getSupabaseServer()
      .from(TABLE)
      .select("*, Cliente(*)")
      .order("FechaEmision", { ascending: false })
      .order("id", { ascending: false });

    if (tenantId != null) {
      query = query.eq("IdTenant", tenantId).eq("Estado", 1);
    }

    if (bCredito) {
      query = query.eq("bCredito", true).neq("Saldo", 0);
      if (idCliente > 0) {
        query = query.eq("IdCliente", idCliente);
      }
    } else {
      const fechaFinEnd = new Date(fechaFin + "T00:00:00");
      fechaFinEnd.setDate(fechaFinEnd.getDate() + 1);
      const fechaFinNext = fechaFinEnd.toISOString().split("T")[0];
      query = query.gte("FechaEmision", fechaIni).lt("FechaEmision", fechaFinNext);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Error fetching ventas: ${error.message}`);
    return (data ?? []) as Documento[];
  },

  /** Get a single document with items and client */
  async getVentaConItem(id: number, tenantId?: number): Promise<Documento | null> {
    let query = getSupabaseServer()
      .from(TABLE)
      .select("*, Cliente(*), DocumentoItem(*)")
      .eq("id", id);

    if (tenantId != null) {
      query = query.eq("IdTenant", tenantId).eq("Estado", 1);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Error fetching documento: ${error.message}`);
    }
    return data as Documento;
  },

  /** Create a sale with items — atomic via RPC */
  async crearVentaConItems(
    doc: Partial<Documento> & { FechaEmision: string; Total: number; bCredito: boolean },
    items: DocumentoItem[],
    idTenant: number,
    idUsuarioCreacion: number
  ): Promise<Documento> {
    const docJson = buildDocumentoJson(doc);
    const itemsJson = buildItemsJson(items);

    const { data, error } = await getSupabaseServer().rpc("crear_venta_con_items", {
      p_documento: docJson,
      p_items: itemsJson,
      p_id_tenant: idTenant,
      p_id_usuario_creacion: idUsuarioCreacion,
    });

    if (error) throw new Error(`Error creating venta: ${error.message}`);
    return data as Documento;
  },

  /** Update a sale with items — atomic via RPC */
  async modificarVentaConItems(
    id: number,
    doc: Partial<Documento> & { FechaEmision: string; Total: number; bCredito: boolean },
    items: DocumentoItem[],
    idTenant: number
  ): Promise<void> {
    // Fetch current items to compute diff
    const { data: currentItems, error: fetchErr } = await getSupabaseServer()
      .from(TABLE_ITEM)
      .select("*")
      .eq("IdDocumento", id)
      .eq("IdTenant", idTenant)
      .eq("Estado", 1);

    if (fetchErr) throw new Error(`Error fetching current items: ${fetchErr.message}`);

    const current = (currentItems ?? []) as DocumentoItem[];
    const updatedItems = items ?? [];

    // Compute diff
    const toDeleteIds = current
      .filter((c) => !updatedItems.some((n) => n.id === c.id))
      .map((c) => c.id);

    const toUpdate = updatedItems.filter((n) => current.some((c) => c.id === n.id));
    const toAdd = updatedItems.filter((n) => !current.some((c) => c.id === n.id));

    const docJson = buildDocumentoJson(doc);

    const itemsToUpdate = toUpdate.map((item) => ({
      id: item.id,
      IdProducto: item.IdProducto,
      Descripcion: item.Descripcion,
      Cantidad: item.Cantidad,
      PrecioVenta: item.PrecioVenta,
      MontoAbono: item.MontoAbono ?? 0,
      Total: item.Total ?? item.Cantidad * item.PrecioVenta,
      IdDocumentoRef: item.IdDocumentoRef ?? null,
    }));

    const itemsToAdd = buildItemsJson(toAdd).map((item) => ({
      ...item,
      IdDocumento: id,
    }));

    const { data, error } = await getSupabaseServer().rpc("modificar_venta_con_items", {
      p_id_documento: id,
      p_documento: docJson,
      p_items_to_soft_delete: toDeleteIds.length > 0 ? toDeleteIds : null,
      p_items_to_update: itemsToUpdate.length > 0 ? itemsToUpdate : null,
      p_items_to_add: itemsToAdd.length > 0 ? itemsToAdd : null,
      p_id_tenant: idTenant,
    });

    if (error) throw new Error(`Error updating venta: ${error.message}`);

    const result = data as { ok?: boolean; error?: string };
    if (result.error) throw new Error(result.error);
  },

  /** Get deleted sales ( Estado = 0 ) with client join */
  async getVentasEliminadas(tenantId?: number): Promise<Documento[]> {
    let query = getSupabaseServer()
      .from(TABLE)
      .select("*, Cliente(*)")
      .order("FechaEmision", { ascending: false })
      .order("id", { ascending: false });

    if (tenantId != null) {
      query = query.eq("IdTenant", tenantId).eq("Estado", 0);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Error fetching ventas eliminadas: ${error.message}`);
    return (data ?? []) as Documento[];
  },

  /** Get ticket text via Supabase RPC */
  async getTicketText(id: number, width: number): Promise<string> {
    const { data, error } = await getSupabaseServer().rpc("generate_ticket_text", {
      venta_id: id,
      width,
    });

    if (error) throw new Error(`Error generating ticket: ${error.message}`);
    return data as string;
  },

  /** Get client addresses */
  async getClienteDirecciones(idCliente: number, tenantId?: number): Promise<ClienteDireccion[]> {
    let query = getSupabaseServer()
      .from("ClienteDireccion")
      .select("*")
      .eq("IdCliente", idCliente);

    if (tenantId != null) {
      query = query.eq("IdTenant", tenantId).eq("Estado", 1);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Error fetching ClienteDireccion: ${error.message}`);
    return (data ?? []) as ClienteDireccion[];
  },

  /** Get payment methods */
  async getMetodoPago(tenantId?: number): Promise<MetodoPago[]> {
    let query = getSupabaseServer()
      .from("MetodoPago")
      .select("*");

    if (tenantId != null) {
      query = query.eq("IdTenant", tenantId).eq("Estado", 1);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Error fetching MetodoPago: ${error.message}`);
    return (data ?? []) as MetodoPago[];
  },

  delete: (id: number) => deleteItem(TABLE, id),
};