import { NextRequest } from "next/server";
import { verifyToken } from "@/lib/jwt";

export interface APIUser {
  id: number;
  codigo: string;
  nombre: string;
  rol: string;
  idTenant: number;
  idNegocio: number | null; // sucursal activa (null en tokens previos a multi-sucursal)
}

export async function getCurrentUserFromRequest(req: NextRequest): Promise<APIUser | null> {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  try {
    const payload = await verifyToken(token);
    return {
      id: parseInt(payload.sub),
      codigo: payload.codigo,
      nombre: payload.nombre,
      rol: payload.rol,
      idTenant: payload.idTenant,
      idNegocio: payload.idNegocio ?? null,
    };
  } catch {
    return null;
  }
}

export function requireAuth(user: APIUser | null): asserts user is APIUser {
  if (!user) {
    throw new Error("Unauthorized");
  }
}

export function requireRole(user: APIUser, roles: readonly string[]): void {
  if (!roles.includes(user.rol)) {
    throw new Error("Forbidden");
  }
}
