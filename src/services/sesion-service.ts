import { createHash, randomUUID } from "crypto";
import { getSupabaseServer } from "@/lib/supabase-server";

const TABLE = "SistemaSesion";

// Ventana de gracia anti-carrera: un refresh token ya rotado (RevocadoEn != null)
// sigue siendo aceptable durante este lapso, porque múltiples requests del mismo
// cliente pueden dispararse en paralelo justo al expirar el access token y todos
// llegan con el token viejo. Fuera de la ventana, un token revocado = reuso real.
const GRACIA_SEGUNDOS = 30;

/** sha256 hex del token opaco. Nunca se guarda el token en crudo. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface CrearSesionInput {
  idUsuario: number;
  idTenant: number;
  /** Duración de la sesión en segundos (30d con "Recordarme", 8h sin). */
  duracionSegundos: number;
  /** Sucursal activa inicial; el refresh la lee para no perderla (ADMIN). */
  idNegocioActivo?: number | null;
  userAgent?: string | null;
  ip?: string | null;
}

export interface SesionEmitida {
  /** Token opaco en crudo — va en la cookie `refresh_token`, no se persiste. */
  token: string;
  /** Instante de expiración absoluto (ISO) — para el maxAge de la cookie. */
  expiraEn: string;
}

export type RotarResult =
  | {
      ok: true;
      /** true: se emitió un token nuevo (setear cookie). false: carrera en
       *  ventana de gracia, reemitir solo el access token sin tocar la cookie. */
      rotada: boolean;
      idUsuario: number;
      idTenant: number;
      idNegocioActivo: number | null; // sucursal activa persistida en la sesión
      token?: string; // presente solo si rotada=true
      expiraEn?: string; // presente solo si rotada=true
    }
  | { ok: false; motivo: "invalido" | "expirado" | "reuso" };

export const sesionService = {
  /** Crea una sesión y devuelve el refresh token opaco (en crudo, una sola vez). */
  async crear(input: CrearSesionInput): Promise<SesionEmitida> {
    const token = randomUUID();
    const expiraEn = new Date(
      Date.now() + input.duracionSegundos * 1000,
    ).toISOString();

    const { error } = await getSupabaseServer()
      .from(TABLE)
      .insert({
        IdUsuario: input.idUsuario,
        IdTenant: input.idTenant,
        TokenHash: hashToken(token),
        Familia: randomUUID(),
        IdNegocioActivo: input.idNegocioActivo ?? null,
        ExpiraEn: expiraEn,
        UserAgent: input.userAgent ?? null,
        Ip: input.ip ?? null,
      });

    if (error) throw new Error(`Error creando sesión: ${error.message}`);
    return { token, expiraEn };
  },

  /**
   * Valida y rota un refresh token. La fila vieja se revoca y se crea una nueva
   * en la misma `Familia` (heredando `ExpiraEn`, expiración absoluta). Maneja:
   * - token desconocido → invalido
   * - sesión expirada → expirado
   * - token revocado dentro de la ventana de gracia → carrera legítima
   *   (rotada=false, reemitir solo el access token)
   * - token revocado fuera de gracia → reuso real → revoca toda la familia
   */
  async rotar(
    token: string,
    meta?: { userAgent?: string | null; ip?: string | null },
  ): Promise<RotarResult> {
    const db = getSupabaseServer();
    const ahora = Date.now();

    const { data: fila, error } = await db
      .from(TABLE)
      .select(
        "id, IdUsuario, IdTenant, Familia, IdNegocioActivo, ExpiraEn, RevocadoEn, UserAgent, Ip",
      )
      .eq("TokenHash", hashToken(token))
      .maybeSingle();

    if (error) throw new Error(`Error leyendo sesión: ${error.message}`);
    if (!fila) return { ok: false, motivo: "invalido" };

    // Token ya rotado: ¿carrera en ventana de gracia o reuso real?
    if (fila.RevocadoEn) {
      const finGracia =
        new Date(fila.RevocadoEn as string).getTime() + GRACIA_SEGUNDOS * 1000;
      if (ahora <= finGracia) {
        return {
          ok: true,
          rotada: false,
          idUsuario: fila.IdUsuario as number,
          idTenant: fila.IdTenant as number,
          idNegocioActivo: fila.IdNegocioActivo as number | null,
        };
      }
      // Reuso: un token revocado hace rato vuelve a aparecer → posible robo.
      await this.revocarFamilia(fila.Familia as string);
      return { ok: false, motivo: "reuso" };
    }

    // Sesión expirada por tiempo absoluto.
    if (new Date(fila.ExpiraEn as string).getTime() <= ahora) {
      await db
        .from(TABLE)
        .update({ RevocadoEn: new Date().toISOString() })
        .eq("id", fila.id)
        .is("RevocadoEn", null);
      return { ok: false, motivo: "expirado" };
    }

    // Rotación: revoca la fila vieja y crea una nueva en la misma familia.
    const nuevoToken = randomUUID();
    const nowIso = new Date().toISOString();

    const { error: revErr } = await db
      .from(TABLE)
      .update({ RevocadoEn: nowIso, UltimoUso: nowIso })
      .eq("id", fila.id)
      .is("RevocadoEn", null);
    if (revErr) throw new Error(`Error rotando sesión: ${revErr.message}`);

    const { error: insErr } = await db.from(TABLE).insert({
      IdUsuario: fila.IdUsuario,
      IdTenant: fila.IdTenant,
      TokenHash: hashToken(nuevoToken),
      Familia: fila.Familia,
      IdNegocioActivo: fila.IdNegocioActivo, // arrastra la sucursal activa
      ExpiraEn: fila.ExpiraEn, // expiración absoluta heredada (no se desliza)
      UserAgent: meta?.userAgent ?? fila.UserAgent ?? null,
      Ip: meta?.ip ?? fila.Ip ?? null,
      UltimoUso: nowIso,
    });
    if (insErr) throw new Error(`Error rotando sesión: ${insErr.message}`);

    return {
      ok: true,
      rotada: true,
      idUsuario: fila.IdUsuario as number,
      idTenant: fila.IdTenant as number,
      idNegocioActivo: fila.IdNegocioActivo as number | null,
      token: nuevoToken,
      expiraEn: fila.ExpiraEn as string,
    };
  },

  /** Revoca la sesión cuyo refresh token se pasa (logout). */
  async revocarPorHash(token: string): Promise<void> {
    const { error } = await getSupabaseServer()
      .from(TABLE)
      .update({ RevocadoEn: new Date().toISOString() })
      .eq("TokenHash", hashToken(token))
      .is("RevocadoEn", null);
    if (error) throw new Error(`Error revocando sesión: ${error.message}`);
  },

  /**
   * Fija la sucursal activa en todas las sesiones vivas del usuario. Se llama al
   * cambiar de sucursal (ADMIN); como la cookie de refresh no llega al endpoint
   * de cambio (path /api/auth), se actualiza por usuario en vez de por sesión.
   */
  async setNegocioActivoDelUsuario(
    idUsuario: number,
    idNegocio: number,
  ): Promise<void> {
    const { error } = await getSupabaseServer()
      .from(TABLE)
      .update({ IdNegocioActivo: idNegocio })
      .eq("IdUsuario", idUsuario)
      .is("RevocadoEn", null);
    if (error)
      throw new Error(`Error fijando sucursal activa: ${error.message}`);
  },

  /** Revoca todas las sesiones de una familia (reuso detectado). */
  async revocarFamilia(familia: string): Promise<void> {
    const { error } = await getSupabaseServer()
      .from(TABLE)
      .update({ RevocadoEn: new Date().toISOString() })
      .eq("Familia", familia)
      .is("RevocadoEn", null);
    if (error) throw new Error(`Error revocando familia: ${error.message}`);
  },

  /** Revoca todas las sesiones activas de un usuario (cambio de contraseña /
   *  desactivación / "cerrar todas las sesiones"). */
  async revocarDelUsuario(idUsuario: number): Promise<void> {
    const { error } = await getSupabaseServer()
      .from(TABLE)
      .update({ RevocadoEn: new Date().toISOString() })
      .eq("IdUsuario", idUsuario)
      .is("RevocadoEn", null);
    if (error) throw new Error(`Error revocando sesiones: ${error.message}`);
  },
};
