import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { kardexService } from "@/services/kardex-service";

export const GET = withAuth(async (req, { user }) => {
  const { searchParams } = new URL(req.url);
  const fechaInicio = searchParams.get("fechaInicio") ?? undefined;
  const fechaFin = searchParams.get("fechaFin") ?? undefined;
  const tipo = searchParams.get("tipo");
  const tipoMovimiento = tipo ? parseInt(tipo) : undefined;

  const data = await kardexService.getAll(user.idTenant, fechaInicio, fechaFin, tipoMovimiento);
  return NextResponse.json({ data });
});
