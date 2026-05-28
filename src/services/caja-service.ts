import { Caja, CajaArqueo } from "@/types/database";
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

    if (error) {
      // 23505 = unique_violation → ya hay una caja abierta para este tenant
      // (índice único parcial UX_Caja_AbiertaPorTenant).
      if (error.code === "23505") {
        throw new Error("Ya existe una caja abierta para este tenant");
      }
      throw new Error(`Error abriendo caja: ${error.message}`);
    }
    return data as Caja;
  },

  /**
   * Cierre atómico. Recalcula MontoEsperado y Diferencia en el servidor
   * vía fn_cerrar_caja — el cliente nunca decide el esperado.
   * La RPC también valida: caja existe, pertenece al tenant y está abierta.
   */
  async cerrarCaja(
    id: number,
    tenantId: number,
    idUsuario: number,
    montoFinal: number,
    observacion: string | null,
  ): Promise<Caja> {
    const { data, error } = await getSupabaseServer().rpc("fn_cerrar_caja", {
      p_id_caja: id,
      p_id_tenant: tenantId,
      p_id_usuario: idUsuario,
      p_monto_final: montoFinal,
      p_observacion: observacion,
    });

    if (error) throw new Error(error.message);
    return data as Caja;
  },

  /** Desglose en vivo del efectivo esperado en la caja abierta o cerrada. */
  async getArqueo(id: number, tenantId: number): Promise<CajaArqueo> {
    const { data, error } = await getSupabaseServer().rpc("fn_caja_arqueo", {
      p_id_caja: id,
      p_id_tenant: tenantId,
    });

    if (error) throw new Error(`Error calculando arqueo: ${error.message}`);
    // La función SQL devuelve una sola fila (TABLE return).
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("Arqueo vacío");
    return row as CajaArqueo;
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
