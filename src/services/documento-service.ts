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
import { auditCreate, auditUpdate } from "@/lib/audit";

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
    negocioId?: number | null,
  ): Promise<Documento[]> {
    let query = getSupabaseServer()
      .from(TABLE)
      .select(
        "*, Cliente(*), MetodoPago(Nombre), " +
          "UsuarioCreacion:SistemaUsuario!FK_Documento_UsuarioCreacion(Nombre)",
      )
      .order("FechaEmision", { ascending: false })
      .order("id", { ascending: false });

    if (tenantId != null) {
      query = query.eq("IdTenant", tenantId).eq("Estado", 1);
    }

    // Sucursal activa (si el token la trae); null → nivel cuenta.
    if (negocioId != null) {
      query = query.eq("IdNegocio", negocioId);
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
    return (data ?? []) as unknown as Documento[];
  },

  /** Get a single document with items, client and creator/modifier names. */
  async getVentaConItem(
    id: number,
    tenantId?: number,
    negocioId?: number | null,
  ): Promise<Documento | null> {
    let query = getSupabaseServer()
      .from(TABLE)
      .select(
        "*, Cliente(*), DocumentoItem(*), " +
          "UsuarioCreacion:SistemaUsuario!FK_Documento_UsuarioCreacion(Nombre), " +
          "UsuarioModificacion:SistemaUsuario!FK_Documento_UsuarioModificacion(Nombre)",
      )
      .eq("id", id);

    if (tenantId != null) {
      query = query.eq("IdTenant", tenantId).eq("Estado", 1);
    }

    if (negocioId != null) {
      query = query.eq("IdNegocio", negocioId);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Error fetching documento: ${error.message}`);
    }
    return data as unknown as Documento;
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
    idUsuario: number,
    idNegocio: number | null = null,
  ): Promise<Documento> {
    const docJson = buildDocumentoJson(doc);

    const isNew = !idDocumento || idDocumento <= 0;

    const toDeleteIds = isNew
      ? []
      : originalItemIds.filter((oid) => !items.some((i) => i.id === oid));
    const toUpdate = isNew ? [] : items.filter((i) => i.id && i.id > 0);
    const toAdd = isNew ? [] : items.filter((i) => !i.id || i.id <= 0);

    // Audit: viaja dentro del JSON. INSERT → auditCreate; UPDATE → auditUpdate.
    const docPayload = isNew
      ? auditCreate(idUsuario, docJson)
      : auditUpdate(idUsuario, docJson);

    const { data, error } = await getSupabaseServer().rpc(
      "guardar_venta_con_items",
      {
        p_id_documento: isNew ? 0 : idDocumento,
        p_documento: docPayload,
        p_items: isNew
          ? buildItemsJson(items).map((it) => auditCreate(idUsuario, it))
          : [],
        p_items_to_delete:
          !isNew && toDeleteIds.length > 0 ? toDeleteIds : null,
        p_items_to_update:
          !isNew && toUpdate.length > 0
            ? toUpdate.map((item) =>
                auditUpdate(idUsuario, {
                  id: item.id,
                  IdProducto: item.IdProducto,
                  Descripcion: item.Descripcion,
                  Cantidad: item.Cantidad,
                  PrecioVenta: item.PrecioVenta,
                  MontoAbono: item.MontoAbono ?? 0,
                  Total: item.Total ?? item.Cantidad * item.PrecioVenta,
                  IdDocumentoRef: item.IdDocumentoRef ?? null,
                }),
              )
            : null,
        p_items_to_add:
          !isNew && toAdd.length > 0
            ? buildItemsJson(toAdd).map((it) => auditCreate(idUsuario, it))
            : null,
        p_id_tenant: idTenant,
        p_id_negocio: idNegocio,
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
    idNegocio: number | null = null,
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
      p_id_negocio: idNegocio,
    });

    if (error) throw new Error(error.message);
    return data as { ok: boolean; abonos: number[]; no_distribuido: number };
  },

  /**
   * Edit an existing payment (abono) — atomic. Only for single-debt abonos
   * (1 item), the 1:1 model produced by registrarAbono. The RPC validates the
   * new amount against the referenced sale's available balance (its Total minus
   * payments from other abono documents) and the DB trigger recomputes the
   * sale's Saldo/TotalAbono.
   */
  async modificarAbono(
    idAbono: number,
    monto: number,
    fecha: string,
    concepto: string | null,
    idMetodoPago: number | null,
    idTenant: number,
    idUsuario: number,
  ): Promise<{ ok: boolean; id_venta: number }> {
    const { data, error } = await getSupabaseServer().rpc("modificar_abono", {
      p_id_abono: idAbono,
      p_monto: monto,
      p_fecha: fecha,
      p_concepto: concepto,
      p_id_metodo_pago: idMetodoPago,
      p_id_tenant: idTenant,
      p_id_usuario_modificacion: idUsuario,
    });

    if (error) throw new Error(error.message);
    const result = data as { ok?: boolean; error?: string; id_venta?: number };
    if (result?.error) throw new Error(result.error);
    return result as { ok: boolean; id_venta: number };
  },

  /**
   * Elimina FÍSICAMENTE un abono (Documento tipo 2).
   *
   * Se borra en duro (no soft-delete) a propósito: el FK
   * DocumentoItem.IdDocumento → Documento(id) es ON DELETE CASCADE, así que al
   * borrar el Documento se borran sus DocumentoItem, y cada DELETE de item
   * dispara fn_actualizar_saldo_total_abono (rama OLD.IdDocumentoRef) que
   * recalcula Saldo/TotalAbono de la venta referenciada. De este modo el saldo
   * se restaura siempre, sin depender de que el trigger filtre por Estado.
   */
  async eliminarAbono(idAbono: number, idTenant: number): Promise<void> {
    const { data: abono, error: fetchErr } = await getSupabaseServer()
      .from(TABLE)
      .select("id, IdTipoDocumento")
      .eq("id", idAbono)
      .eq("IdTenant", idTenant)
      .single();

    if (fetchErr || !abono) throw new Error("Abono no encontrado");
    if ((abono as { IdTipoDocumento: number }).IdTipoDocumento !== 2) {
      throw new Error("El documento no es un abono");
    }

    // Borrado físico — la cascada borra los items y el trigger restaura el Saldo
    const { error } = await getSupabaseServer()
      .from(TABLE)
      .delete()
      .eq("id", idAbono)
      .eq("IdTenant", idTenant)
      .eq("IdTipoDocumento", 2);

    if (error) throw new Error(`Error eliminando abono: ${error.message}`);
  },

  /** Get deleted sales ( Estado = 0 ) with client join + creador */
  async getVentasEliminadas(tenantId?: number, negocioId?: number | null): Promise<Documento[]> {
    let query = getSupabaseServer()
      .from(TABLE)
      .select(
        "*, Cliente(*), " +
          "UsuarioCreacion:SistemaUsuario!FK_Documento_UsuarioCreacion(Nombre)",
      )
      .order("FechaEmision", { ascending: false })
      .order("id", { ascending: false });

    if (tenantId != null) {
      query = query.eq("IdTenant", tenantId).eq("Estado", 0);
    }

    if (negocioId != null) {
      query = query.eq("IdNegocio", negocioId);
    }

    const { data, error } = await query;
    if (error)
      throw new Error(`Error fetching ventas eliminadas: ${error.message}`);
    return (data ?? []) as unknown as Documento[];
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
    negocioId?: number | null,
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

    // Sucursal activa; null (p.ej. link público) → todas las sucursales.
    if (negocioId != null) {
      query = query.eq("IdNegocio", negocioId);
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
  async getDeudaResumen(tenantId: number, negocioId?: number | null): Promise<DeudaResumen[]> {
    const { data, error } = await getSupabaseServer().rpc("fn_deuda_resumen", {
      p_id_tenant: tenantId,
      p_id_negocio: negocioId ?? null,
    });
    if (error)
      throw new Error(`Error calling fn_deuda_resumen: ${error.message}`);
    return (data ?? []) as DeudaResumen[];
  },

  /**
   * Vincula uno o varios documentos a una caja (para arqueo). Filtra por
   * tenant por seguridad y solo actualiza filas activas.
   */
  async setIdCaja(
    idDocumento: number | number[],
    idCaja: number,
    tenantId: number,
    idUsuario: number,
  ): Promise<void> {
    const ids = Array.isArray(idDocumento) ? idDocumento : [idDocumento];
    if (ids.length === 0) return;
    const { error } = await getSupabaseServer()
      .from(TABLE)
      .update(auditUpdate(idUsuario, { IdCaja: idCaja }))
      .in("id", ids)
      .eq("IdTenant", tenantId)
      .eq("Estado", 1);
    if (error) throw new Error(`Error vinculando IdCaja: ${error.message}`);
  },

  delete: (id: number) => deleteItem(TABLE, id),
};
