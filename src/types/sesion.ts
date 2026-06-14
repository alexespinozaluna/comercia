// Tipo compartido cliente/servidor para la UI de "Sesiones activas".
// Vive aquí (y no en sesion-service) para que la página cliente no importe un
// módulo de servidor (supabase-server). No expone TokenHash ni Familia.

export interface SesionActivaDTO {
  id: number;
  UserAgent: string | null;
  Ip: string | null;
  FechaCreacion: string;
  UltimoUso: string | null;
  ExpiraEn: string;
  /** true = la sesión desde la que se hace la consulta (este dispositivo). */
  esActual: boolean;
}
