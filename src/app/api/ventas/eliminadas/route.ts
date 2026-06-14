import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { documentoService } from "@/services/documento-service";

export const GET = withAuth(async (_req, { user }) => {
  const data = await documentoService.getVentasEliminadas(user.idTenant, user.idNegocio);
  return NextResponse.json({ data });
});
