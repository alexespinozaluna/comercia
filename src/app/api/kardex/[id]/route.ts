import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { kardexService } from "@/services/kardex-service";

export const GET = withAuth<{ id: string }>(async (req, { user, params }) => {
  const productId = parseInt(params.id);

  const { searchParams } = new URL(req.url);
  const fechaInicio = searchParams.get("fechaInicio") ?? undefined;
  const fechaFin = searchParams.get("fechaFin") ?? undefined;

  const data = await kardexService.getByProducto(productId, user.idTenant, fechaInicio, fechaFin, user.idNegocio);
  return NextResponse.json({ data });
});
