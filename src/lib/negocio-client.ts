import type { Negocio } from "@/types/database";
import { apiGet } from "@/lib/api-client";

/** Negocio de un documento: /api/negocio devuelve las sucursales del tenant;
 * se elige la que coincide con idNegocio (o la primera). */
export async function fetchNegocio(idNegocio: number | null | undefined): Promise<Negocio | null> {
  const list = await apiGet<Negocio[]>("/api/negocio");
  const arr = Array.isArray(list) ? list : [];
  return arr.find((n) => n.id === idNegocio) ?? arr[0] ?? null;
}
