import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { cajaService } from "@/services/caja-service";

export const GET = withAuth(async (_req, { user }) => {
  const data = await cajaService.getCajaAbierta(user.idTenant, user.idNegocio);
  return NextResponse.json({ data });
});
