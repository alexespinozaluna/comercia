import {
  Documento,
  DocumentoItem,
  MetodoPago,
  ClienteDireccion,
  DeudaDetalle,
  DeudaResumen,
} from "@/types/database";
import { getSupabaseServer } from "@/lib/supabase-server";
import { deleteItem } from "./supabase-service";

const TABLE = "Documento";
const MAX_FIELD_LEN = 500;

/** Truncate a string to MAX_FIELD_LEN, return null if empty/null */
function truncateField(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_FIELD_LEN
    ? trimmed.substring(0, MAX_FIELD_LEN)
    : trimmed;
}

/** Build a clean JSONB object from a Documento for RPC calls (strips nested relations and id=0) */
function buildDocumentoJson(
  doc: Partial<Documento> & {
    FechaEmision: string;
    Total: number;
    bCredito: boolean;
  },
): Record<string, unknown> {
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
    tenantId?: number,
    id?: number,
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
      if (id != null && id > 0) {
        query = query.eq("id", id);
      }
      if (idCliente > 0) {
        query = query.eq("IdCliente", idCliente);
      }
    } else {
      const fechaFinEnd = new Date(fechaFin + "T00:00:00");
      fechaFinEnd.setDate(fechaFinEnd.getDate() + 1);
      const fechaFinNext = fechaFinEnd.toISOString().split("T")[0];
      query = query
        .gte("FechaEmision", fechaIni)
        .lt("FechaEmision", fechaFinNext);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Error fetching ventas: ${error.message}`);
    console.log("Fetched ventas:", data);
    return (data ?? []) as Documento[];
  },

  /** Get a single document with items and client */
  async getVentaConItem(
    id: number,
    tenantId?: number,
  ): Promise<Documento | null> {
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

  /**
   * Save a sale with items — create or update, fully atomic via a single RPC.
   *
   * `idDocumento` null/0 → create (items go in p_items); > 0 → update, where the
   * diff is computed here against `originalItemIds` (the item ids the sale had
   * when it loaded) and the current `items`. The whole insert/update/delete runs
   * inside one PostgreSQL transaction, so a network error or concurrent change
   * can no longer leave the sale half-saved.
   */
  async guardarVentaConItems(
    idDocumento: number | null,
    doc: Partial<Documento> & {
      FechaEmision: string;
      Total: number;
      bCredito: boolean;
    },
    items: DocumentoItem[],
    originalItemIds: number[],
    idTenant: number,
    idUsuarioCreacion: number,
  ): Promise<Documento> {
    const docJson = buildDocumentoJson(doc);

    const isNew = !idDocumento || idDocumento <= 0;

    const toDeleteIds = isNew
      ? []
      : originalItemIds.filter((oid) => !items.some((i) => i.id === oid));
    const toUpdate = isNew ? [] : items.filter((i) => i.id && i.id > 0);
    const toAdd = isNew ? [] : items.filter((i) => !i.id || i.id <= 0);

    const { data, error } = await getSupabaseServer().rpc(
      "guardar_venta_con_items",
      {
        p_id_documento: isNew ? 0 : idDocumento,
        p_documento: docJson,
        p_items: isNew ? buildItemsJson(items) : [],
        p_items_to_delete:
          !isNew && toDeleteIds.length > 0 ? toDeleteIds : null,
        p_items_to_update:
          !isNew && toUpdate.length > 0
            ? toUpdate.map((item) => ({
                id: item.id,
                IdProducto: item.IdProducto,
                Descripcion: item.Descripcion,
                Cantidad: item.Cantidad,
                PrecioVenta: item.PrecioVenta,
                MontoAbono: item.MontoAbono ?? 0,
                Total: item.Total ?? item.Cantidad * item.PrecioVenta,
                IdDocumentoRef: item.IdDocumentoRef ?? null,
              }))
            : null,
        p_items_to_add: !isNew && toAdd.length > 0 ? buildItemsJson(toAdd) : null,
        p_id_tenant: idTenant,
        p_id_usuario_creacion: idUsuarioCreacion,
      },
    );

    if (error) throw new Error(`Error guardando venta: ${error.message}`);
    const result = data as { ok?: boolean; error?: string } | Documento;
    if ((result as { error?: string }).error)
      throw new Error((result as { error?: string }).error);
    return data as Documento;
  },

  /**
   * Register a payment (abono) over debts — atomic, FIFO distribution server-side.
   *
   * `tipo` 1 → pay a single sale (`id` = IdDocumento); 2 → pay all of a client's
   * debts (`id` = IdCliente). The RPC covers debts oldest-first, validates the
   * amount against the real pending balance, and creates one Documento + one item
   * per debt (IdDocumentoRef) inside a single transaction. The DB trigger then
   * recomputes each sale's Saldo/TotalAbono.
   */
  async registrarAbono(
    tipo: number,
    id: number,
    monto: number,
    fecha: string,
    concepto: string | null,
    idMetodoPago: number | null,
    idTenant: number,
    idUsuario: number,
  ): Promise<{ ok: boolean; abonos: number[]; no_distribuido: number }> {
    const { data, error } = await getSupabaseServer().rpc("registrar_abono", {
      p_tipo: tipo,
      p_id: id,
      p_monto: monto,
      p_fecha: fecha,
      p_concepto: concepto,
      p_id_metodo_pago: idMetodoPago,
      p_id_tenant: idTenant,
      p_id_usuario: idUsuario,
    });

    if (error) throw new Error(error.message);
    return data as { ok: boolean; abonos: number[]; no_distribuido: number };
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
    if (error)
      throw new Error(`Error fetching ventas eliminadas: ${error.message}`);
    return (data ?? []) as Documento[];
  },

  /** Get ticket text via Supabase RPC */
  async getTicketText(id: number, width: number): Promise<string> {
    const { data, error } = await getSupabaseServer().rpc(
      "generate_ticket_text",
      {
        venta_id: id,
        width,
      },
    );

    if (error) throw new Error(`Error generating ticket: ${error.message}`);
    return data as string;
  },

  /** Get client addresses */
  async getClienteDirecciones(
    idCliente: number,
    tenantId?: number,
  ): Promise<ClienteDireccion[]> {
    let query = getSupabaseServer()
      .from("ClienteDireccion")
      .select("*")
      .eq("IdCliente", idCliente);

    if (tenantId != null) {
      query = query.eq("IdTenant", tenantId).eq("Estado", 1);
    }

    const { data, error } = await query;
    if (error)
      throw new Error(`Error fetching ClienteDireccion: ${error.message}`);
    return (data ?? []) as ClienteDireccion[];
  },

  /** Get payment methods */
  async getMetodoPago(tenantId?: number): Promise<MetodoPago[]> {
    let query = getSupabaseServer().from("MetodoPago").select("*");

    if (tenantId != null) {
      query = query.eq("IdTenant", tenantId).eq("Estado", 1);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Error fetching MetodoPago: ${error.message}`);
    return (data ?? []) as MetodoPago[];
  },

  /**
   * Detalle de deudas activas (vista `v_deuda_detalle`).
   * Filtra por tenant siempre; si se pasa idCliente, filtra solo ese cliente.
   */
  async getDeudaDetalle(
    tenantId: number,
    idCliente?: number,
  ): Promise<DeudaDetalle[]> {
    let query = getSupabaseServer()
      .from("v_deuda_detalle")
      .select("*")
      .eq("IdTenant", tenantId)
      .order("FechaEmision", { ascending: false })
      .order("id", { ascending: false });

    if (idCliente != null) {
      query = query.eq("IdCliente", idCliente);
    }

    const { data, error } = await query;
    if (error)
      throw new Error(`Error fetching v_deuda_detalle: ${error.message}`);
    return (data ?? []) as DeudaDetalle[];
  },

  /**
   * Resumen de deudas agrupado por cliente (función `fn_deuda_resumen`).
   * Ya viene ordenado por monto pendiente DESC desde la BD.
   */
  async getDeudaResumen(tenantId: number): Promise<DeudaResumen[]> {
    const { data, error } = await getSupabaseServer().rpc("fn_deuda_resumen", {
      p_id_tenant: tenantId,
    });
    if (error)
      throw new Error(`Error calling fn_deuda_resumen: ${error.message}`);
    return (data ?? []) as DeudaResumen[];
  },

  delete: (id: number) => deleteItem(TABLE, id),
};
