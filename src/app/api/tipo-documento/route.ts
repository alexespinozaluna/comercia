import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { documentoService } from "@/services/documento-service";

export const GET = withAuth(async () => {
  const data = await documentoService.getTipoDocumento();
  return NextResponse.json({ data });
});
