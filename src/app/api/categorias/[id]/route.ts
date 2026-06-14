import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { PERMISOS } from "@/lib/permisos";
import { categoriaService } from "@/services/categoria-service";

export const PUT = withAuth<{ id: string }>(
  async (req, { user, params }) => {
    const { id } = params;
    const { Nombre } = await req.json();

    await categoriaService.rename(parseInt(id, 10), user.idTenant, String(Nombre ?? ""), user.id);
    return NextResponse.json({ ok: true });
  },
  { roles: PERMISOS.VENTAS_Y_CATALOGO, exposeErrors: true },
);

export const DELETE = withAuth<{ id: string }>(
  async (_req, { user, params }) => {
    const { id } = params;
    await categoriaService.remove(parseInt(id, 10), user.idTenant, user.id);
    return NextResponse.json({ ok: true });
  },
  { roles: PERMISOS.ADMINISTRACION, exposeErrors: true },
);
