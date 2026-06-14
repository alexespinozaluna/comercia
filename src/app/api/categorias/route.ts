import { NextResponse } from "next/server";
import { withAuth, ApiError } from "@/lib/api-handler";
import { PERMISOS } from "@/lib/permisos";
import { categoriaService } from "@/services/categoria-service";

export const GET = withAuth(async (_req, { user }) => {
  const data = await categoriaService.getAll(user.idTenant);
  return NextResponse.json({ data });
});

export const POST = withAuth(
  async (req, { user }) => {
    const { Nombre } = await req.json();
    if (!Nombre || !String(Nombre).trim()) {
      throw new ApiError(400, "Nombre requerido");
    }

    const data = await categoriaService.create(user.idTenant, String(Nombre), user.id);
    return NextResponse.json({ data });
  },
  { roles: PERMISOS.VENTAS_Y_CATALOGO, exposeErrors: true },
);
