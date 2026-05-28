import { Categoria, SIN_CATEGORIA_ID } from "@/types/database";
import { getSupabaseServer } from "@/lib/supabase-server";

const TABLE = "Categoria";

export const categoriaService = {
  /** Categorías del tenant + la sentinel "Sin categoría" (id 0), activas. */
  async getAll(tenantId: number): Promise<Categoria[]> {
    const { data, error } = await getSupabaseServer()
      .from(TABLE)
      .select("*")
      .or(`IdTenant.eq.${tenantId},id.eq.${SIN_CATEGORIA_ID}`)
      .eq("Estado", 1)
      .order("id", { ascending: true });

    if (error) throw new Error(`Error fetching categorías: ${error.message}`);
    return (data ?? []) as Categoria[];
  },

  async create(tenantId: number, nombre: string): Promise<Categoria> {
    const limpio = nombre.trim();
    if (!limpio) throw new Error("El nombre de la categoría es requerido");

    const { data, error } = await getSupabaseServer()
      .from(TABLE)
      .insert({ IdTenant: tenantId, Nombre: limpio, Estado: 1 })
      .select()
      .single();

    if (error) throw new Error(`Error creando categoría: ${error.message}`);
    return data as Categoria;
  },

  async rename(id: number, tenantId: number, nombre: string): Promise<void> {
    if (id === SIN_CATEGORIA_ID) throw new Error("No se puede editar 'Sin categoría'");
    const limpio = nombre.trim();
    if (!limpio) throw new Error("El nombre de la categoría es requerido");

    const { error } = await getSupabaseServer()
      .from(TABLE)
      .update({ Nombre: limpio })
      .eq("id", id)
      .eq("IdTenant", tenantId);

    if (error) throw new Error(`Error renombrando categoría: ${error.message}`);
  },

  /**
   * Soft-delete de una categoría. Los productos que la usaban vuelven a
   * "Sin categoría" (IdCategoria = 0) para no quedar huérfanos.
   */
  async remove(id: number, tenantId: number): Promise<void> {
    if (id === SIN_CATEGORIA_ID) throw new Error("No se puede borrar 'Sin categoría'");

    const supabase = getSupabaseServer();

    const { error: prodErr } = await supabase
      .from("Producto")
      .update({ IdCategoria: SIN_CATEGORIA_ID })
      .eq("IdCategoria", id)
      .eq("IdTenant", tenantId);
    if (prodErr) throw new Error(`Error reasignando productos: ${prodErr.message}`);

    const { error } = await supabase
      .from(TABLE)
      .update({ Estado: 0 })
      .eq("id", id)
      .eq("IdTenant", tenantId);
    if (error) throw new Error(`Error borrando categoría: ${error.message}`);
  },
};
