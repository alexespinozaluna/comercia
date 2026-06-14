import { NextResponse } from "next/server";
import { withAuth, ApiError } from "@/lib/api-handler";
import { linkPublicoService } from "@/services/link-publico-service";

// Mapea cada tipo de recurso a su ruta pública.
const RUTAS_PUBLICAS: Record<string, string> = {
  deuda_cliente: "/p/deuda",
  venta: "/p/venta",
};

// Requiere auth: la llama el admin para generar/obtener el link a compartir.
export const POST = withAuth(async (req, { user }) => {
  const { tipoRecurso, idRecurso, metadata } = await req.json();
  if (!tipoRecurso || !idRecurso) {
    throw new ApiError(400, "tipoRecurso e idRecurso son requeridos");
  }

  const link = await linkPublicoService.getOrCreate(
    user.idTenant,
    tipoRecurso,
    idRecurso,
    user.id,
    metadata,
  );

  const origin = req.headers.get("origin") ?? req.nextUrl.origin;
  const ruta = RUTAS_PUBLICAS[tipoRecurso] ?? "/p";
  const url = `${origin}${ruta}/${link.Token}`;

  return NextResponse.json({ data: { token: link.Token, url } });
});

// Requiere auth: revoca el link público activo de un recurso del tenant.
// DELETE /api/link-publico?tipoRecurso=deuda_cliente&idRecurso=123
export const DELETE = withAuth(async (req, { user }) => {
  const tipoRecurso = req.nextUrl.searchParams.get("tipoRecurso");
  const idRecurso = req.nextUrl.searchParams.get("idRecurso");
  if (!tipoRecurso || !idRecurso) {
    throw new ApiError(400, "tipoRecurso e idRecurso son requeridos");
  }

  await linkPublicoService.revocarPorRecurso(
    user.idTenant,
    tipoRecurso,
    Number(idRecurso),
  );

  return NextResponse.json({ data: { ok: true } });
});
