import { SistemaUsuario } from "@/types/database";
import { getSupabaseServer } from "@/lib/supabase-server";
import { verifyPassword, hashPassword } from "@/lib/password";
import { negocioService } from "@/services/negocio-service";
import { auditCreate, auditUpdate } from "@/lib/audit";
import { ROLES_VALIDOS, Rol, UsuarioSinPassword } from "@/types/usuario";

const TABLE = "SistemaUsuario";

const SELECT_PUBLIC =
  "id, Codigo, Nombre, Rol, IdTenant, IdNegocio, Estado, FechaCreacion";
const SELECT_AUTH =
  "id, Codigo, Nombre, PasswordHash, Rol, IdTenant, IdNegocio, Estado, FechaCreacion";

export interface CreateUsuarioInput {
  Codigo: string;
  Nombre: string;
  Password: string;
  Rol: string;
  IdNegocio: number | null;
}

export interface UpdateUsuarioInput {
  Nombre?: string;
  Password?: string;
  Rol?: string;
  IdNegocio?: number | null;
  Estado?: number;
}

export const usuarioService = {
  /** Find user by code for login. Codigo es UNIQUE global → no necesita tenant. */
  async findByCodigo(codigo: string): Promise<SistemaUsuario | null> {
    const { data, error } = await getSupabaseServer()
      .from(TABLE)
      .select(SELECT_AUTH)
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

  /** Get user by ID con guard de tenant (excluye PasswordHash). */
  async getById(id: number, tenant: number): Promise<UsuarioSinPassword | null> {
    const { data, error } = await getSupabaseServer()
      .from(TABLE)
      .select(SELECT_PUBLIC)
      .eq("id", id)
      .eq("IdTenant", tenant)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Error fetching usuario: ${error.message}`);
    }
    return data as UsuarioSinPassword;
  },

  /** Lista usuarios (activos e inactivos) del tenant, orden por Nombre. */
  async listByTenant(tenant: number): Promise<UsuarioSinPassword[]> {
    const { data, error } = await getSupabaseServer()
      .from(TABLE)
      .select(SELECT_PUBLIC)
      .eq("IdTenant", tenant)
      .order("Nombre", { ascending: true });

    if (error) throw new Error(`Error fetching usuarios: ${error.message}`);
    return (data ?? []) as UsuarioSinPassword[];
  },

  /** Cuenta ADMINs activos del tenant; opcionalmente excluye un id. */
  async countActiveAdmins(tenant: number, excludeId?: number): Promise<number> {
    let query = getSupabaseServer()
      .from(TABLE)
      .select("id", { count: "exact", head: true })
      .eq("IdTenant", tenant)
      .eq("Rol", "ADMIN")
      .eq("Estado", 1);
    if (excludeId != null) query = query.neq("id", excludeId);
    const { count, error } = await query;
    if (error) throw new Error(`Error counting admins: ${error.message}`);
    return count ?? 0;
  },

  async create(
    tenant: number,
    input: CreateUsuarioInput,
    idUsuarioActor: number,
  ): Promise<UsuarioSinPassword> {
    if (!input.Codigo?.trim()) throw new Error("Codigo requerido");
    if (!input.Nombre?.trim()) throw new Error("Nombre requerido");
    if (!input.Password) throw new Error("Password requerido");
    if (!ROLES_VALIDOS.includes(input.Rol as Rol)) {
      throw new Error(`Rol invalido. Permitidos: ${ROLES_VALIDOS.join(", ")}`);
    }

    if (input.Rol !== "ADMIN") {
      if (input.IdNegocio == null) {
        throw new Error(`IdNegocio requerido para rol ${input.Rol}`);
      }
      const negocio = await negocioService.getById(input.IdNegocio, tenant);
      if (!negocio) {
        throw new Error("Negocio no encontrado o no pertenece al tenant");
      }
    }

    const PasswordHash = await hashPassword(input.Password);
    const idNegocioFinal = input.Rol === "ADMIN" ? null : input.IdNegocio;

    const { data, error } = await getSupabaseServer()
      .from(TABLE)
      .insert(
        auditCreate(idUsuarioActor, {
          Codigo: input.Codigo.trim(),
          Nombre: input.Nombre.trim(),
          PasswordHash,
          Rol: input.Rol,
          IdTenant: tenant,
          IdNegocio: idNegocioFinal,
          Estado: 1,
        }),
      )
      .select(SELECT_PUBLIC)
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error(`El codigo "${input.Codigo}" ya esta en uso`);
      }
      throw new Error(`Error creando usuario: ${error.message}`);
    }
    return data as UsuarioSinPassword;
  },

  async update(
    id: number,
    tenant: number,
    input: UpdateUsuarioInput,
    idUsuarioActor: number,
  ): Promise<boolean> {
    const actual = await this.getById(id, tenant);
    if (!actual) throw new Error("Usuario no encontrado");

    if (input.Rol != null && !ROLES_VALIDOS.includes(input.Rol as Rol)) {
      throw new Error(`Rol invalido. Permitidos: ${ROLES_VALIDOS.join(", ")}`);
    }

    const rolFinal = input.Rol ?? actual.Rol;
    const idNegocioFinal =
      input.IdNegocio !== undefined ? input.IdNegocio : actual.IdNegocio;

    if (rolFinal !== "ADMIN") {
      if (idNegocioFinal == null) {
        throw new Error(`IdNegocio requerido para rol ${rolFinal}`);
      }
      if (input.IdNegocio != null) {
        const negocio = await negocioService.getById(input.IdNegocio, tenant);
        if (!negocio) {
          throw new Error("Negocio no encontrado o no pertenece al tenant");
        }
      }
    }

    // Anti-lockout: si se degrada o desactiva un ADMIN, debe quedar al menos uno activo.
    const quitaAdmin =
      actual.Rol === "ADMIN" && input.Rol != null && input.Rol !== "ADMIN";
    const desactivaAdmin = actual.Rol === "ADMIN" && input.Estado === 0;
    if (quitaAdmin || desactivaAdmin) {
      const restantes = await this.countActiveAdmins(tenant, id);
      if (restantes === 0) {
        throw new Error("No se puede dejar al tenant sin ADMIN activo");
      }
    }

    const patch: Record<string, unknown> = {};
    if (input.Nombre !== undefined) patch.Nombre = input.Nombre.trim();
    if (input.Rol !== undefined) patch.Rol = input.Rol;
    if (input.IdNegocio !== undefined) {
      patch.IdNegocio = rolFinal === "ADMIN" ? null : input.IdNegocio;
    } else if (rolFinal === "ADMIN" && actual.IdNegocio != null) {
      // Si el rol final es ADMIN, mantenemos la invariante IdNegocio = NULL.
      patch.IdNegocio = null;
    }
    if (input.Estado !== undefined) patch.Estado = input.Estado;
    if (input.Password) patch.PasswordHash = await hashPassword(input.Password);

    if (Object.keys(patch).length === 0) return true;

    const { error } = await getSupabaseServer()
      .from(TABLE)
      .update(auditUpdate(idUsuarioActor, patch))
      .eq("id", id)
      .eq("IdTenant", tenant);

    if (error) throw new Error(`Error actualizando usuario: ${error.message}`);
    return true;
  },

  async softDelete(
    id: number,
    tenant: number,
    idUsuarioActor: number,
  ): Promise<boolean> {
    const actual = await this.getById(id, tenant);
    if (!actual) throw new Error("Usuario no encontrado");

    if (actual.Rol === "ADMIN") {
      const restantes = await this.countActiveAdmins(tenant, id);
      if (restantes === 0) {
        throw new Error("No se puede desactivar al ultimo ADMIN del tenant");
      }
    }

    const { error } = await getSupabaseServer()
      .from(TABLE)
      .update(auditUpdate(idUsuarioActor, { Estado: 0 }))
      .eq("id", id)
      .eq("IdTenant", tenant);

    if (error) throw new Error(`Error desactivando usuario: ${error.message}`);
    return true;
  },
};
