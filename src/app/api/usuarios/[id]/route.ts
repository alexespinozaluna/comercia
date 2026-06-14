import { NextResponse } from "next/server";
import { withAuth, ApiError } from "@/lib/api-handler";
import { usuarioService } from "@/services/usuario-service";

// El detalle/edición de un usuario es ADMIN exacto (el SUPERVISOR ve la lista,
// no el formulario). No usa los grupos de PERMISOS.
const SOLO_ADMIN = ["ADMIN"] as const;

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export const GET = withAuth<{ id: string }>(
  async (_req, { user, params }) => {
    const idUsuario = parseId(params.id);
    if (idUsuario == null) {
      throw new ApiError(400, "id invalido");
    }

    const data = await usuarioService.getById(idUsuario, user.idTenant);
    if (!data) {
      throw new ApiError(404, "Usuario no encontrado");
    }
    return NextResponse.json({ data });
  },
  { roles: SOLO_ADMIN, exposeErrors: true },
);

export const PUT = withAuth<{ id: string }>(
  async (req, { user, params }) => {
    const idUsuario = parseId(params.id);
    if (idUsuario == null) {
      throw new ApiError(400, "id invalido");
    }

    const body = await req.json();

    // Auto-protección: el ADMIN no puede cambiar su propio Rol ni Estado por esta ruta.
    if (idUsuario === user.id) {
      if (body.Rol != null && body.Rol !== "ADMIN") {
        throw new ApiError(400, "No puedes cambiar tu propio rol");
      }
      if (body.Estado === 0) {
        throw new ApiError(400, "No puedes desactivarte a ti mismo");
      }
    }

    await usuarioService.update(
      idUsuario,
      user.idTenant,
      {
        Nombre: body.Nombre,
        Password: body.Password || undefined,
        Rol: body.Rol,
        IdNegocio: body.IdNegocio,
        Estado: body.Estado,
      },
      user.id,
    );
    return NextResponse.json({ ok: true });
  },
  { roles: SOLO_ADMIN, exposeErrors: true },
);

export const DELETE = withAuth<{ id: string }>(
  async (_req, { user, params }) => {
    const idUsuario = parseId(params.id);
    if (idUsuario == null) {
      throw new ApiError(400, "id invalido");
    }

    if (idUsuario === user.id) {
      throw new ApiError(400, "No puedes desactivarte a ti mismo");
    }

    await usuarioService.softDelete(idUsuario, user.idTenant, user.id);
    return NextResponse.json({ ok: true });
  },
  { roles: SOLO_ADMIN, exposeErrors: true },
);
