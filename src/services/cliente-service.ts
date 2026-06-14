import { Cliente } from "@/types/database";
import { getSupabaseServer } from "@/lib/supabase-server";

const TABLE = "Cliente";

// Las altas/ediciones de Cliente + ClienteDireccion van por el RPC transaccional
// `guardar_cliente_con_direcciones` (el diff insert/update/soft-delete de las
// direcciones se hace en plpgsql). Este servicio solo lee.
export const clienteService = {
  /** Get all clients with their addresses */
  async getAllWithDirecciones(tenantId?: number): Promise<Cliente[]> {
    let query = getSupabaseServer()
      .from(TABLE)
      .select("*, ClienteDireccion(*)");

    if (tenantId != null) {
      query = query.eq("IdTenant", tenantId).eq("Estado", 1);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Error fetching ${TABLE}: ${error.message}`);
    return (data ?? []) as Cliente[];
  },

  /** Get a single client with addresses */
  async getByIdWithDirecciones(id: number, tenantId?: number): Promise<Cliente | null> {
    let query = getSupabaseServer()
      .from(TABLE)
      .select("*, ClienteDireccion(*)")
      .eq("id", id);

    if (tenantId != null) {
      query = query.eq("IdTenant", tenantId).eq("Estado", 1);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Error fetching ${TABLE}: ${error.message}`);
    }
    return data as Cliente;
  },
};
