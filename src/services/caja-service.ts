import { Caja } from "@/types/database";
import { getSupabaseServer } from "@/lib/supabase-server";

const TABLE = "Caja";

export const cajaService = {
  async getCajaAbierta(tenantId: number): Promise<Caja | null> {
    const { data, error } = await getSupabaseServer()
      .from(TABLE)
      .select("*")
      .eq("IdTenant", tenantId)
      .eq("Estado", 1)
      .order("FechaApertura", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Error fetching caja: ${error.message}`);
    }
    return data as Caja;
  },

  async abrirCaja(tenantId: number, idUsuario: number, montoInicial: number): Promise<Caja> {
    const { data, error } = await getSupabaseServer()
      .from(TABLE)
      .insert({
        IdTenant: tenantId,
        IdUsuarioApertura: idUsuario,
        MontoInicial: montoInicial,
        Estado: 1,
      })
      .select()
      .single();

    if (error) throw new Error(`Error abriendo caja: ${error.message}`);
    return data as Caja;
  },

  async cerrarCaja(id: number, idUsuario: number, montoFinal: number): Promise<void> {
    const { error } = await getSupabaseServer()
      .from(TABLE)
      .update({
        FechaCierre: new Date().toISOString(),
        MontoFinal: montoFinal,
        Estado: 0,
        IdUsuarioCierre: idUsuario,
      })
      .eq("id", id);

    if (error) throw new Error(`Error cerrando caja: ${error.message}`);
  },

  async getHistorial(tenantId: number, limit = 20): Promise<Caja[]> {
    const { data, error } = await getSupabaseServer()
      .from(TABLE)
      .select("*")
      .eq("IdTenant", tenantId)
      .order("FechaApertura", { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Error fetching historial caja: ${error.message}`);
    return (data ?? []) as Caja[];
  },
};
