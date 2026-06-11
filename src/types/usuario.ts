import { SistemaUsuario } from "./database";

// Tipos compartidos cliente/servidor del módulo de usuarios.
// Viven aquí (y no en usuario-service) para que las páginas cliente
// no importen un módulo de servidor (supabase-server).

export type UsuarioSinPassword = Omit<SistemaUsuario, "PasswordHash">;

export const ROLES_VALIDOS = [
  "ADMIN",
  "CAJERO",
  "VENDEDOR",
  "SUPERVISOR",
  "COBRANZA",
] as const;
export type Rol = (typeof ROLES_VALIDOS)[number];
