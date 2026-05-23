import { SistemaUsuario } from "@/types/database";
import { getSupabaseServer } from "@/lib/supabase-server";
import { verifyPassword } from "@/lib/password";

const TABLE = "SistemaUsuario";

export const usuarioService = {
  /** Find user by code for login validation — returns full row including PasswordHash */
  async findByCodigo(codigo: string): Promise<SistemaUsuario | null> {
    const { data, error } = await getSupabaseServer()
      .from(TABLE)
      .select("id, Codigo, Nombre, PasswordHash, Rol, IdTenant, Estado, FechaCreacion")
      .eq("Codigo", codigo)
      .eq("Estado", 1)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Error fetching usuario: ${error.message}`);
    }
    return data as SistemaUsuario;
  },

  /** Validate login credentials — used only in server-side auth route */
  async validateLogin(
    codigo: string,
    password: string,
  ): Promise<SistemaUsuario | null> {
    const user = await this.findByCodigo(codigo);
    if (!user) return null;
    const ok = await verifyPassword(password, user.PasswordHash);
    return ok ? user : null;
  },

  /** Get user by ID — excludes PasswordHash for safety */
  async getById(id: number): Promise<Omit<SistemaUsuario, "PasswordHash"> | null> {
    const { data, error } = await getSupabaseServer()
      .from(TABLE)
      .select("id, Codigo, Nombre, Rol, IdTenant, Estado, FechaCreacion")
      .eq("id", id)
      .eq("Estado", 1)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Error fetching usuario: ${error.message}`);
    }
    return data as Omit<SistemaUsuario, "PasswordHash">;
  },
};