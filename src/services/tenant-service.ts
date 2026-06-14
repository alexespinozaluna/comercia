import { getSupabaseServer } from "@/lib/supabase-server";
import { hashPassword } from "@/lib/password";
import { SistemaTenant } from "@/types/database";

export interface ProvisionarTenantInput {
  codigo: string;
  nombre: string;
  adminCodigo: string;
  adminNombre: string;
  adminPassword: string;
  negocioNombre: string;
  locale: string;
  decimales: number;
  simbolo: string;
}

export const tenantService = {
  /** Todos los tenants (uso SUPERADMIN). */
  async list(): Promise<SistemaTenant[]> {
    const { data, error } = await getSupabaseServer()
      .from("SistemaTenant")
      .select("*")
      .order("id", { ascending: false });
    if (error) throw new Error(`Error listando tenants: ${error.message}`);
    return (data ?? []) as SistemaTenant[];
  },

  /**
   * Crea un tenant completo (tenant + admin + sucursal + métodos de pago) de
   * forma transaccional vía RPC. El PasswordHash del admin se genera aquí
   * (bcrypt), nunca en SQL. Devuelve el id del tenant creado.
   */
  async provisionar(
    input: ProvisionarTenantInput,
    idUsuarioActor: number,
  ): Promise<number> {
    const passwordHash = await hashPassword(input.adminPassword);

    const { data, error } = await getSupabaseServer().rpc("provisionar_tenant", {
      p_codigo: input.codigo.trim(),
      p_nombre: input.nombre.trim(),
      p_admin_codigo: input.adminCodigo.trim(),
      p_admin_nombre: input.adminNombre.trim(),
      p_admin_password_hash: passwordHash,
      p_negocio_nombre: input.negocioNombre.trim(),
      p_locale: input.locale,
      p_decimales: input.decimales,
      p_simbolo: input.simbolo,
      p_id_usuario_actor: idUsuarioActor,
    });

    if (error) {
      if (error.code === "23505") {
        throw new Error("El código de tenant o de usuario ya existe");
      }
      throw new Error(`Error provisionando tenant: ${error.message}`);
    }
    return data as number;
  },
};
