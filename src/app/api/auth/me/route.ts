import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";

export const GET = withAuth(async (_req, { user }) => {
  return NextResponse.json({
    user: {
      id: user.id,
      codigo: user.codigo,
      nombre: user.nombre,
      rol: user.rol,
      idTenant: user.idTenant,
      idNegocio: user.idNegocio,
    },
  });
});
