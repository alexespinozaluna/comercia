import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/api-auth";
import { negocioService } from "@/services/negocio-service";
import { sesionService } from "@/services/sesion-service";
import { createToken } from "@/lib/jwt";
import { setAccessCookie } from "@/lib/auth-cookies";

// POST: cambia la sucursal activa de la sesión. Solo ADMIN — los demás roles
// tienen su sucursal fija (SistemaUsuario.IdNegocio).
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (user.rol !== "ADMIN") {
      return NextResponse.json({ error: "Solo ADMIN" }, { status: 403 });
    }

    const { idNegocio } = await req.json();
    if (!idNegocio || idNegocio <= 0) {
      return NextResponse.json({ error: "idNegocio requerido" }, { status: 400 });
    }

    const negocio = await negocioService.getById(idNegocio, user.idTenant);
    if (!negocio) {
      return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
    }
    if (negocio.Estado !== 1) {
      return NextResponse.json({ error: "El negocio está inactivo" }, { status: 400 });
    }

    // Persistir la sucursal activa para que sobreviva al refresh del access
    // token (que recomputa claims desde BD).
    await sesionService.setNegocioActivoDelUsuario(user.id, negocio.id);

    const token = await createToken({
      sub: String(user.id),
      codigo: user.codigo,
      nombre: user.nombre,
      rol: user.rol,
      idTenant: user.idTenant,
      idNegocio: negocio.id,
    });

    const response = NextResponse.json({
      data: {
        id: user.id,
        codigo: user.codigo,
        nombre: user.nombre,
        rol: user.rol,
        idTenant: user.idTenant,
        idNegocio: negocio.id,
      },
    });

    // Access token consistente con login/refresh (45 min, SameSite=Strict).
    // OJO: la sucursal activa viaja solo en el claim; al refrescar a los 45 min
    // se recomputa desde BD. Ver nota de IdNegocioActivo en el doc de sesiones.
    setAccessCookie(response, token);

    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
