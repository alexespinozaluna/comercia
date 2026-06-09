import { ProductoMovimiento, ProductoMovimientoAjuste } from "@/types/database";
import { getSupabaseServer } from "@/lib/supabase-server";

const TABLE = "ProductoMovimiento";

// Tipos de movimiento que cuentan como "ajuste de inventario":
// 3 Fabricación, 4 Merma/Daño, 5 Vencimiento, 6 Inventario Físico.
// Excluye 1 Venta, 2 Compra/Stock inicial y 7 Anulación venta.
const TIPOS_AJUSTE = [3, 4, 5, 6];

/** Fin de rango inclusivo: "YYYY-MM-DD" → día siguiente "YYYY-MM-DD".
 * `Fecha` es timestamp; con `lt(díaSiguiente)` se incluye todo el día Fin
 * (de otro modo `lte("YYYY-MM-DD")` lo trata como medianoche y excluye el día). */
function endExclusive(fechaFin: string): string {
  const [y, m, d] = fechaFin.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

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
      query = query.lt("Fecha", endExclusive(fechaFin));
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
      query = query.lt("Fecha", endExclusive(fechaFin));
    }
    if (tipoMovimiento != null) {
      query = query.eq("TipoMovimiento", tipoMovimiento);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Error fetching kardex: ${error.message}`);
    return (data ?? []) as ProductoMovimiento[];
  },

  /** Ajustes de inventario (tipos 3-6) del tenant/sucursal en un rango de fechas.
   * Adjunta el nombre del producto (segunda consulta; no hay FK para embedding).
   * Fin de rango inclusivo. */
  async getAjustes(
    tenantId: number,
    negocioId?: number | null,
    fechaInicio?: string,
    fechaFin?: string,
    tipos: number[] = TIPOS_AJUSTE,
  ): Promise<ProductoMovimientoAjuste[]> {
    const supabase = getSupabaseServer();

    let query = supabase
      .from(TABLE)
      .select("*")
      .eq("IdTenant", tenantId)
      .in("TipoMovimiento", tipos)
      .order("Fecha", { ascending: false });

    if (negocioId != null) {
      query = query.eq("IdNegocio", negocioId);
    }
    if (fechaInicio) {
      query = query.gte("Fecha", fechaInicio);
    }
    if (fechaFin) {
      query = query.lt("Fecha", endExclusive(fechaFin));
    }

    const { data, error } = await query;
    if (error) throw new Error(`Error fetching ajustes: ${error.message}`);

    const movimientos = (data ?? []) as ProductoMovimiento[];
    if (movimientos.length === 0) return [];

    // Nombres de producto en una sola consulta.
    const ids = [...new Set(movimientos.map((m) => m.IdProducto))];
    const { data: productos, error: prodError } = await supabase
      .from("Producto")
      .select("id, Nombre")
      .in("id", ids);
    if (prodError) throw new Error(`Error fetching nombres de producto: ${prodError.message}`);

    const nombrePorId = new Map<number, string>(
      (productos ?? []).map((p: { id: number; Nombre: string }) => [p.id, p.Nombre]),
    );

    return movimientos.map((m) => ({
      ...m,
      ProductoNombre: nombrePorId.get(m.IdProducto) ?? null,
    }));
  },
};
