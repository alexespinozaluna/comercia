import { Producto } from "@/types/database";
import { getSupabaseServer } from "@/lib/supabase-server";
import { add, update, deleteItem } from "./supabase-service";

const TABLE = "Producto";

export const productoService = {
  async getAll(tenantId?: number): Promise<Producto[]> {
    let query = getSupabaseServer().from(TABLE).select("*");
    if (tenantId != null) {
      query = query.eq("IdTenant", tenantId).eq("Estado", 1);
    }
    const { data, error } = await query;
    if (error) throw new Error(`Error fetching ${TABLE}: ${error.message}`);
    return (data ?? []) as Producto[];
  },

  async getById(id: number, tenantId?: number): Promise<Producto | null> {
    let query = getSupabaseServer().from(TABLE).select("*").eq("id", id);
    if (tenantId != null) {
      query = query.eq("IdTenant", tenantId).eq("Estado", 1);
    }
    const { data, error } = await query.single();
    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Error fetching ${TABLE}: ${error.message}`);
    }
    return data as Producto;
  },

  add: (item: Partial<Producto>) => add<Producto>(TABLE, item),
  update: (id: number, item: Partial<Producto>) => update<Producto>(TABLE, id, item),
  delete: (id: number) => deleteItem(TABLE, id),
};
