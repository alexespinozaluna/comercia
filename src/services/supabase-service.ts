import { getSupabaseServer } from "@/lib/supabase-server";

/**
 * Quita `id` cuando es 0 o undefined antes de un INSERT (port de C# CleanJsonId).
 * Es la pieza de los guardados master-detail que permite insertar filas nuevas
 * (los detalles con `id:0`) dejando que Postgres asigne el id real.
 * Exportada para pruebas; en runtime la usa `add`.
 */
export function cleanJsonId(obj: Record<string, unknown>): Record<string, unknown> {
  if (obj.id === 0 || obj.id === undefined) {
    const { id, ...rest } = obj;
    return rest as Record<string, unknown>;
  }
  return obj;
}

/**
 * Helpers REST genéricos sobre Supabase (port parcial de SupabaseService<T>).
 *
 * ADVERTENCIA multi-tenant: estas funciones operan solo por `id` y NO
 * filtran por IdTenant. El llamador (route/servicio) DEBE validar que el
 * registro pertenece al tenant del usuario antes de mutar o exponer datos.
 */
export async function add<T>(table: string, item: Partial<T>): Promise<T> {
  const cleaned = cleanJsonId(item as Record<string, unknown>);
  const { data, error } = await getSupabaseServer()
    .from(table)
    .insert(cleaned)
    .select()
    .single();

  if (error) throw new Error(`Error adding ${table}: ${error.message}`);
  return data as T;
}

export async function update<T>(
  table: string,
  id: number,
  item: Partial<T>
): Promise<boolean> {
  const { error } = await getSupabaseServer()
    .from(table)
    .update(item as Record<string, unknown>)
    .eq("id", id);

  if (error) {
    console.error(`Error updating ${table}: ${error.message}`);
    return false;
  }
  return true;
}

export async function deleteItem(table: string, id: number): Promise<void> {
  const { error } = await getSupabaseServer()
    .from(table)
    .delete()
    .eq("id", id);

  if (error) throw new Error(`Error deleting ${table}: ${error.message}`);
}
