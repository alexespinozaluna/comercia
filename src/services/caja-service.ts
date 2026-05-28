import { Caja, CajaArqueo, CajaHistorialItem } from "@/types/database";
import { getSupabaseServer } from "@/lib/supabase-server";

const TABLE = "Caja";

export const cajaService = {
  async getCajaAbierta(tenantId: number, idNegocio?: number | null): Promise<Caja | null> {
    let query = getSupabaseServer()
      .from(TABLE)
      .select("*")
      .eq("IdTenant", tenantId)
      .eq("Estado", 1);

    // Acota a la sucursal activa; con idNegocio nulo (token previo) queda a nivel cuenta.
    if (idNegocio != null) query = query.eq("IdNegocio", idNegocio);

    const { data, error } = await query
      .order("FechaApertura", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Error fetching caja: ${error.message}`);
    }
    return data as Caja;
  },

  async abrirCaja(
    tenantId: number,
    idUsuario: number,
    montoInicial: number,
    idNegocio?: number | null,
  ): Promise<Caja> {
    const { data, error } = await getSupabaseServer()
      .from(TABLE)
      .insert({
        IdTenant: tenantId,
        IdNegocio: idNegocio ?? null,
        IdUsuarioApertura: idUsuario,
        MontoInicial: montoInicial,
        Estado: 1,
      })
      .select()
      .single();

    if (error) {
      // 23505 = unique_violation → ya hay una caja abierta para esta sucursal
      // (índice único parcial UX_Caja_AbiertaPorNegocio).
      if (error.code === "23505") {
        throw new Error("Ya existe una caja abierta para esta sucursal");
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

  /**
   * Historial de caja con filtros. Resuelve los nombres de cajero (apertura/cierre)
   * vía join embebido con SistemaUsuario.
   *
   * - `desde`/`hasta` filtran por FechaApertura (ISO yyyy-mm-dd).
   * - `idUsuario` filtra por quien abrió O cerró (cualquiera de los dos).
   * - `soloDescuadre` deja solo cierres con Diferencia != 0.
   */
  async getHistorial(
    tenantId: number,
    opts: {
      desde?: string;
      hasta?: string;
      idUsuario?: number;
      soloDescuadre?: boolean;
      limit?: number;
      idNegocio?: number | null;
    } = {},
  ): Promise<CajaHistorialItem[]> {
    const { desde, hasta, idUsuario, soloDescuadre, limit = 100, idNegocio } = opts;

    let query = getSupabaseServer()
      .from(TABLE)
      .select("*")
      .eq("IdTenant", tenantId)
      .order("FechaApertura", { ascending: false })
      .limit(limit);

    // Sucursal activa; null → nivel cuenta.
    if (idNegocio != null) query = query.eq("IdNegocio", idNegocio);

    if (desde) query = query.gte("FechaApertura", desde);
    if (hasta) {
      // hasta inclusivo: avanzar 1 día y usar lt
      const next = new Date(hasta + "T00:00:00");
      next.setDate(next.getDate() + 1);
      query = query.lt("FechaApertura", next.toISOString().split("T")[0]);
    }
    if (idUsuario && idUsuario > 0) {
      query = query.or(
        `IdUsuarioApertura.eq.${idUsuario},IdUsuarioCierre.eq.${idUsuario}`,
      );
    }
    if (soloDescuadre) {
      query = query.neq("Diferencia", 0).not("Diferencia", "is", null);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Error fetching historial caja: ${error.message}`);

    const rows = (data ?? []) as Caja[];
    if (rows.length === 0) return [];

    // Resolver nombres de cajeros en una sola consulta extra
    const userIds = Array.from(
      new Set(
        rows.flatMap((r) =>
          [r.IdUsuarioApertura, r.IdUsuarioCierre].filter(
            (id): id is number => typeof id === "number" && id > 0,
          ),
        ),
      ),
    );

    const nameById = new Map<number, string>();
    if (userIds.length > 0) {
      const { data: users } = await getSupabaseServer()
        .from("SistemaUsuario")
        .select("id, Nombre")
        .eq("IdTenant", tenantId)
        .in("id", userIds);
      for (const u of (users ?? []) as { id: number; Nombre: string }[]) {
        nameById.set(u.id, u.Nombre);
      }
    }

    return rows.map((r) => ({
      ...r,
      NomUsuarioApertura: nameById.get(r.IdUsuarioApertura) ?? null,
      NomUsuarioCierre:
        r.IdUsuarioCierre != null ? nameById.get(r.IdUsuarioCierre) ?? null : null,
    })) as CajaHistorialItem[];
  },
};
