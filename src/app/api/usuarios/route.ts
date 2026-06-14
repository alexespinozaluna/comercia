import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { usuarioService } from "@/services/usuario-service";

// Crear/editar/eliminar usuarios exige ADMIN exacto. La lectura la comparte el
// SUPERVISOR (solo vista). No usa los grupos de PERMISOS.
const SOLO_ADMIN = ["ADMIN"] as const;
const VER_USUARIOS = ["ADMIN", "SUPERVISOR"] as const;

export const GET = withAuth(
  async (_req, { user }) => {
    const data = await usuarioService.listByTenant(user.idTenant);
    return NextResponse.json({ data });
  },
  { roles: VER_USUARIOS },
);

export const POST = withAuth(
  async (req, { user }) => {
    const body = await req.json();
    const data = await usuarioService.create(
      user.idTenant,
      {
        Codigo: body.Codigo,
        Nombre: body.Nombre,
        Password: body.Password,
        Rol: body.Rol,
        IdNegocio: body.IdNegocio ?? null,
      },
      user.id,
    );
    return NextResponse.json({ data });
  },
  { roles: SOLO_ADMIN, exposeErrors: true },
);
