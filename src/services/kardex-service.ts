import { ProductoMovimiento } from "@/types/database";
import { getSupabaseServer } from "@/lib/supabase-server";

const TABLE = "ProductoMovimiento";

export const kardexService = {
  async getByProducto(idProducto: number, tenantId?: number, fechaInicio?: string, fechaFin?: string, negocioId?: number | null): Promise<ProductoMovimiento[]> {
    let query = getSupabaseServer()
      .from(TABLE)
      .select("*")
      .eq("IdProducto", idProducto)
      .order("Fecha", { ascending: false });

    if (tenantId != null) {
      query = query.eq("IdTenant", tenantId);
    }
    if (negocioId != null) {
      query = query.eq("IdNegocio", negocioId);
    }
    if (fechaInicio) {
      query = query.gte("Fecha", fechaInicio);
    }
    if (fechaFin) {
      query = query.lte("Fecha", fechaFin);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Error fetching kardex: ${error.message}`);
    return (data ?? []) as ProductoMovimiento[];
  },

  async getAll(tenantId: number, fechaInicio?: string, fechaFin?: string, tipoMovimiento?: number): Promise<ProductoMovimiento[]> {
    let query = getSupabaseServer()
      .from(TABLE)
      .select("*")
      .eq("IdTenant", tenantId)
      .order("Fecha", { ascending: false });

    if (fechaInicio) {
      query = query.gte("Fecha", fechaInicio);
    }
    if (fechaFin) {
      query = query.lte("Fecha", fechaFin);
    }
    if (tipoMovimiento != null) {
      query = query.eq("TipoMovimiento", tipoMovimiento);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Error fetching kardex: ${error.message}`);
    return (data ?? []) as ProductoMovimiento[];
  },
};