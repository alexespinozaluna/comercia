import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/api-auth";
import { linkPublicoService } from "@/services/link-publico-service";

// Mapea cada tipo de recurso a su ruta pública.
const RUTAS_PUBLICAS: Record<string, string> = {
  deuda_cliente: "/p/deuda",
  venta: "/p/venta",
};

// Requiere auth: la llama el admin para generar/obtener el link a compartir.
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { tipoRecurso, idRecurso, metadata } = await req.json();
    if (!tipoRecurso || !idRecurso) {
      return NextResponse.json(
        { error: "tipoRecurso e idRecurso son requeridos" },
        { status: 400 }
      );
    }

    const link = await linkPublicoService.getOrCreate(
      user.idTenant,
      tipoRecurso,
      idRecurso,
      metadata
    );

    const origin = req.headers.get("origin") ?? req.nextUrl.origin;
    const ruta = RUTAS_PUBLICAS[tipoRecurso] ?? "/p";
    const url = `${origin}${ruta}/${link.Token}`;

    return NextResponse.json({ data: { token: link.Token, url } });
  } catch (err) {
    console.error("POST /api/link-publico error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// Requiere auth: revoca el link público activo de un recurso del tenant.
// DELETE /api/link-publico?tipoRecurso=deuda_cliente&idRecurso=123
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tipoRecurso = req.nextUrl.searchParams.get("tipoRecurso");
    const idRecurso = req.nextUrl.searchParams.get("idRecurso");
    if (!tipoRecurso || !idRecurso) {
      return NextResponse.json(
        { error: "tipoRecurso e idRecurso son requeridos" },
        { status: 400 }
      );
    }

    await linkPublicoService.revocarPorRecurso(
      user.idTenant,
      tipoRecurso,
      Number(idRecurso)
    );

    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    console.error("DELETE /api/link-publico error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
