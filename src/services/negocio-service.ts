import { Negocio } from "@/types/database";
import { getSupabaseServer } from "@/lib/supabase-server";
import { auditUpdate } from "@/lib/audit";

const TABLE = "Negocio";

export const negocioService = {
  /** Lista los negocios (sucursales) activos de un tenant, ordenados por id. */
  async listByTenant(tenant: number): Promise<Negocio[]> {
    const { data, error } = await getSupabaseServer()
      .from(TABLE)
      .select("*")
      .eq("IdTenant", tenant)
      .eq("Estado", 1)
      .order("id", { ascending: true });

    if (error) throw new Error(`Error fetching Negocios: ${error.message}`);
    return (data ?? []) as Negocio[];
  },

  /** Un negocio por id, validando que pertenezca al tenant. */
  async getById(id: number, tenant: number): Promise<Negocio | null> {
    const { data, error } = await getSupabaseServer()
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .eq("IdTenant", tenant)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Error fetching Negocio: ${error.message}`);
    }
    return data as Negocio;
  },

  /** Negocio por defecto del tenant (la sucursal activa más antigua). */
  async getDefaultForTenant(tenant: number): Promise<Negocio | null> {
    const list = await this.listByTenant(tenant);
    return list[0] ?? null;
  },

  /** Actualiza un negocio, con guard de tenant. */
  async update(
    id: number,
    tenant: number,
    item: Partial<Negocio>,
    idUsuario: number,
  ): Promise<boolean> {
    const { error } = await getSupabaseServer()
      .from(TABLE)
      .update(auditUpdate(idUsuario, item))
      .eq("id", id)
      .eq("IdTenant", tenant);

    if (error) throw new Error(`Error updating Negocio: ${error.message}`);
    return true;
  },
};
