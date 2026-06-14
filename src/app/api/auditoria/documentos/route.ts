import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { PERMISOS } from "@/lib/permisos";
import { auditoriaService } from "@/services/auditoria-service";

export const GET = withAuth(
  async (req, { user }) => {
    const { searchParams } = new URL(req.url);
    const fechaInicio = searchParams.get("fechaInicio") ?? undefined;
    const fechaFin = searchParams.get("fechaFin") ?? undefined;
    const operacion = searchParams.get("operacion") ?? undefined;
    const data = await auditoriaService.getDocumentoAudits(user.idTenant, fechaInicio, fechaFin, operacion);
    return NextResponse.json({ data });
  },
  { roles: PERMISOS.ADMINISTRACION },
);
