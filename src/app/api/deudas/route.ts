import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { documentoService } from "@/services/documento-service";

export const GET = withAuth(async (_req, { user }) => {
  const data = await documentoService.getVentas("", "", true, 0, user.idTenant);
  return NextResponse.json({ data });
});
