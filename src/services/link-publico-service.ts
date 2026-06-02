import { randomUUID } from "crypto";
import { LinkPublico } from "@/types/database";
import { getSupabaseServer } from "@/lib/supabase-server";
import { auditCreate } from "@/lib/audit";

const TABLE = "LinkPublico";

export const linkPublicoService = {
  /** Reutiliza el token activo del recurso si existe; si no, crea uno nuevo. */
  async getOrCreate(
    idTenant: number,
    tipoRecurso: string,
    idRecurso: number,
    idUsuario: number,
    metadata?: Record<string, unknown>
  ): Promise<LinkPublico> {
    const sb = getSupabaseServer();

    // Buscar uno activo y sin expiración para ese recurso.
    const { data: existing } = await sb
      .from(TABLE)
      .select("*")
      .eq("IdTenant", idTenant)
      .eq("TipoRecurso", tipoRecurso)
      .eq("IdRecurso", idRecurso)
      .eq("Estado", 1)
      .is("FechaExpiracion", null)
      .limit(1)
      .maybeSingle();

    if (existing) return existing as LinkPublico;

    // Crear nuevo (el Token lo genera la BD por defecto).
    const { data, error } = await sb
      .from(TABLE)
      .insert(
        auditCreate(idUsuario, {
          Token: randomUUID(), // generado en código (no dependemos del DEFAULT de la BD)
          IdTenant: idTenant,
          TipoRecurso: tipoRecurso,
          IdRecurso: idRecurso,
          Metadata: metadata ?? null,
          Estado: 1,
        }),
      )
      .select()
      .single();

    if (error) throw new Error(`Error creando LinkPublico: ${error.message}`);
    return data as LinkPublico;
  },

  /** Valida un token activo/no expirado, registra el último acceso y lo retorna. */
  async validar(token: string): Promise<LinkPublico | null> {
    const sb = getSupabaseServer();

    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("Token", token)
      .eq("Estado", 1)
      .maybeSingle();

    if (error || !data) return null;

    const link = data as LinkPublico;

    if (link.FechaExpiracion && new Date(link.FechaExpiracion) < new Date()) {
      return null;
    }

    // Registrar último acceso. Se hace con await: en serverless un
    // fire-and-forget tras la respuesta puede descartarse.
    await sb
      .from(TABLE)
      .update({ FechaUltimoAcceso: new Date().toISOString() })
      .eq("id", link.id);

    return link;
  },

  async revocar(id: number): Promise<void> {
    const { error } = await getSupabaseServer()
      .from(TABLE)
      .update({ Estado: 0 })
      .eq("id", id);
    if (error) throw new Error(`Error revocando LinkPublico: ${error.message}`);
  },

  /** Revoca (Estado=0) los links activos de un recurso dentro de un tenant. */
  async revocarPorRecurso(
    idTenant: number,
    tipoRecurso: string,
    idRecurso: number
  ): Promise<void> {
    const { error } = await getSupabaseServer()
      .from(TABLE)
      .update({ Estado: 0 })
      .eq("IdTenant", idTenant)
      .eq("TipoRecurso", tipoRecurso)
      .eq("IdRecurso", idRecurso)
      .eq("Estado", 1);
    if (error) throw new Error(`Error revocando LinkPublico: ${error.message}`);
  },
};
