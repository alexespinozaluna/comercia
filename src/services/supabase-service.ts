import { getSupabaseServer } from "@/lib/supabase-server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const REST_URL = `${SUPABASE_URL}/rest/v1`;

/** Strip "id":0 from JSON before insert (matches C# CleanJsonId) */
function cleanJsonId(obj: Record<string, unknown>): Record<string, unknown> {
  if (obj.id === 0 || obj.id === undefined) {
    const { id, ...rest } = obj;
    return rest as Record<string, unknown>;
  }
  return obj;
}

function cleanJsonIdArray(items: Record<string, unknown>[]): Record<string, unknown>[] {
  return items.map(cleanJsonId);
}

/**
 * Generic Supabase REST service (port of SupabaseService<T>).
 *
 * ADVERTENCIA multi-tenant: estas funciones operan solo por `id` y NO
 * filtran por IdTenant. El llamador (route/servicio) DEBE validar que el
 * registro pertenece al tenant del usuario antes de mutar o exponer datos.
 */
export async function getAll<T>(table: string, select = "*"): Promise<T[]> {
  const { data, error } = await getSupabaseServer()
    .from(table)
    .select(select);

  if (error) throw new Error(`Error fetching ${table}: ${error.message}`);
  return (data ?? []) as T[];
}

export async function getById<T>(table: string, id: number, select = "*"): Promise<T | null> {
  const { data, error } = await getSupabaseServer()
    .from(table)
    .select(select)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // no rows
    throw new Error(`Error fetching ${table} by id: ${error.message}`);
  }
  return data as T;
}

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

// Export for use in master-detail services that need raw REST calls
export { cleanJsonId, cleanJsonIdArray, SUPABASE_URL, REST_URL };