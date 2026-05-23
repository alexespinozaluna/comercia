import { Negocio } from "@/types/database";
import { getSupabaseServer } from "@/lib/supabase-server";
import { update, getAll } from "./supabase-service";

const TABLE = "Negocio";

export const negocioService = {
  async get(): Promise<Negocio | null> {
    const { data, error } = await getSupabaseServer()
      .from(TABLE)
      .select("*")
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Error fetching Negocio: ${error.message}`);
    }
    return data as Negocio;
  },

  async update(id: number, item: Partial<Negocio>): Promise<boolean> {
    return update(TABLE, id, item);
  },
};
