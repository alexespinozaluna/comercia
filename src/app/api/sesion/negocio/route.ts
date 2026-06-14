import { NextResponse } from "next/server";
import { withAuth, ApiError } from "@/lib/api-handler";
import { negocioService } from "@/services/negocio-service";
import { sesionService } from "@/services/sesion-service";
import { createToken } from "@/lib/jwt";
import { setAccessCookie } from "@/lib/auth-cookies";

// POST: cambia la sucursal activa de la sesión. ADMIN y SUPERVISOR (este último,
// de solo lectura, para supervisar otras sucursales). Los demás roles tienen su
// sucursal fija (SistemaUsuario.IdNegocio).
export const POST = withAuth(
  async (req, { user }) => {
    const { idNegocio } = await req.json();
    if (!idNegocio || idNegocio <= 0) {
      throw new ApiError(400, "idNegocio requerido");
    }

    const negocio = await negocioService.getById(idNegocio, user.idTenant);
    if (!negocio) {
      throw new ApiError(404, "Negocio no encontrado");
    }
    if (negocio.Estado !== 1) {
      throw new ApiError(400, "El negocio está inactivo");
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
  },
  // Cambio de sucursal es autoservicio de sesión (no muta datos de negocio) →
  // allowReadOnly para que el SUPERVISOR pueda supervisar otras sucursales.
  { roles: ["ADMIN", "SUPERVISOR"], exposeErrors: true, allowReadOnly: true },
);
