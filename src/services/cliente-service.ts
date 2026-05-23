import { Cliente, ClienteDireccion } from "@/types/database";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getAll, add, deleteItem } from "./supabase-service";

const TABLE = "Cliente";

export const clienteService = {
  /** Get all clients with their addresses */
  async getAllWithDirecciones(tenantId?: number): Promise<Cliente[]> {
    let query = getSupabaseServer()
      .from(TABLE)
      .select("*, ClienteDireccion(*)");

    if (tenantId != null) {
      query = query.eq("IdTenant", tenantId).eq("Estado", 1);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Error fetching ${TABLE}: ${error.message}`);
    return (data ?? []) as Cliente[];
  },

  /** Get a single client with addresses */
  async getByIdWithDirecciones(id: number, tenantId?: number): Promise<Cliente | null> {
    let query = getSupabaseServer()
      .from(TABLE)
      .select("*, ClienteDireccion(*)")
      .eq("id", id);

    if (tenantId != null) {
      query = query.eq("IdTenant", tenantId).eq("Estado", 1);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Error fetching ${TABLE}: ${error.message}`);
    }
    return data as Cliente;
  },

  /** Save client with addresses (create or update) using diff-based pattern */
  async saveClienteConDirecciones(
    idCliente: number | null,
    cliente: Cliente
  ): Promise<number> {
    // Deep clone to avoid circular references
    const { ClienteDireccion: direcciones, ...clienteData } = cliente;

    if (!idCliente || idCliente === 0) {
      // CREATE
      const { id, ...clienteNoId } = clienteData as Cliente & { id: number };
      const { data, error } = await getSupabaseServer()
        .from(TABLE)
        .insert(clienteNoId)
        .select()
        .single();

      if (error) throw new Error(`Error creating Cliente: ${error.message}`);
      idCliente = (data as Cliente).id;
    } else {
      // UPDATE
      const { id, FechaCreacion, ...clienteNoId } = clienteData as Cliente & { id: number; FechaCreacion: string };
      const { error } = await getSupabaseServer()
        .from(TABLE)
        .update(clienteNoId)
        .eq("id", idCliente);

      if (error) throw new Error(`Error updating Cliente: ${error.message}`);
    }

    // Fetch current addresses
    const { data: currentDirecciones, error: fetchErr } = await getSupabaseServer()
      .from("ClienteDireccion")
      .select("*")
      .eq("IdCliente", idCliente);

    if (fetchErr) throw new Error(`Error fetching ClienteDireccion: ${fetchErr.message}`);

    const current = (currentDirecciones ?? []) as ClienteDireccion[];
    const newDirecciones = direcciones ?? [];

    // Diff: delete, update, add
    const toDelete = current.filter((c) => !newDirecciones.some((n) => n.id === c.id));
    const toUpdate = newDirecciones.filter((n) => current.some((c) => c.id === n.id));
    const toAdd = newDirecciones.filter((n) => !current.some((c) => c.id === n.id));

    // Batch delete
    if (toDelete.length > 0) {
      const idsToDelete = toDelete.map((d) => d.id);
      const { error: delErr } = await getSupabaseServer()
        .from("ClienteDireccion")
        .delete()
        .in("id", idsToDelete);

      if (delErr) throw new Error(`Error deleting ClienteDireccion: ${delErr.message}`);
    }

    // Individual updates
    for (const item of toUpdate) {
      const { id, FechaCreacion, ...updateData } = item as ClienteDireccion & { id: number; FechaCreacion?: string };
      const { error: updErr } = await getSupabaseServer()
        .from("ClienteDireccion")
        .update(updateData)
        .eq("id", id);

      if (updErr) throw new Error(`Error updating ClienteDireccion: ${updErr.message}`);
    }

    // Batch insert new addresses
    if (toAdd.length > 0) {
      const addData = toAdd.map(({ id, ...rest }) => ({
        ...rest,
        IdCliente: idCliente,
      }));
      const { error: addErr } = await getSupabaseServer()
        .from("ClienteDireccion")
        .insert(addData);

      if (addErr) throw new Error(`Error adding ClienteDireccion: ${addErr.message}`);
    }

    return idCliente;
  },

  delete: (id: number) => deleteItem(TABLE, id),
};