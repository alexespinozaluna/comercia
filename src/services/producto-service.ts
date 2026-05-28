import { Producto } from "@/types/database";
import { getSupabaseServer } from "@/lib/supabase-server";
import { add, update, deleteItem } from "./supabase-service";

const TABLE = "Producto";

/**
 * Sobrescribe `Cantidad` de cada producto con el stock de la sucursal activa
 * (ProductoStock). Catálogo compartido, stock por sucursal. Solo afecta a
 * productos que rastrean stock (Cantidad de catálogo no nula); los que no
 * rastrean quedan en null. Sin fila de stock → 0.
 */
async function aplicarStockSucursal(productos: Producto[], negocioId: number): Promise<void> {
  const ids = productos.filter((p) => p.Cantidad != null).map((p) => p.id);
  if (ids.length === 0) return;

  const { data } = await getSupabaseServer()
    .from("ProductoStock")
    .select("IdProducto, Cantidad")
    .eq("IdNegocio", negocioId)
    .in("IdProducto", ids);

  const stockById = new Map<number, number>();
  for (const r of (data ?? []) as { IdProducto: number; Cantidad: number }[]) {
    stockById.set(r.IdProducto, r.Cantidad);
  }
  for (const p of productos) {
    if (p.Cantidad != null) p.Cantidad = stockById.get(p.id) ?? 0;
  }
}

export const productoService = {
  async getAll(tenantId?: number, soloActivos = false, negocioId?: number | null): Promise<Producto[]> {
    let query = getSupabaseServer().from(TABLE).select("*");
    if (tenantId != null) {
      query = query.eq("IdTenant", tenantId).eq("Estado", 1);
    }
    if (soloActivos) {
      query = query.eq("bActivoVenta", true);
    }
    const { data, error } = await query;
    if (error) throw new Error(`Error fetching ${TABLE}: ${error.message}`);

    const productos = (data ?? []) as Producto[];
    if (negocioId != null) await aplicarStockSucursal(productos, negocioId);
    return productos;
  },

  async getById(id: number, tenantId?: number, negocioId?: number | null): Promise<Producto | null> {
    let query = getSupabaseServer().from(TABLE).select("*").eq("id", id);
    if (tenantId != null) {
      query = query.eq("IdTenant", tenantId).eq("Estado", 1);
    }
    const { data, error } = await query.single();
    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Error fetching ${TABLE}: ${error.message}`);
    }
    const producto = data as Producto;
    if (negocioId != null) await aplicarStockSucursal([producto], negocioId);
    return producto;
  },

  add: (item: Partial<Producto>) => add<Producto>(TABLE, item),
  update: (id: number, item: Partial<Producto>) => update<Producto>(TABLE, id, item),
  delete: (id: number) => deleteItem(TABLE, id),
};
