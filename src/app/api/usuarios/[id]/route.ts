import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/api-auth";
import { usuarioService } from "@/services/usuario-service";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (user.rol !== "ADMIN") {
      return NextResponse.json({ error: "Solo ADMIN" }, { status: 403 });
    }

    const { id } = await params;
    const idUsuario = parseId(id);
    if (idUsuario == null) {
      return NextResponse.json({ error: "id invalido" }, { status: 400 });
    }

    const data = await usuarioService.getById(idUsuario, user.idTenant);
    if (!data) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/usuarios/[id] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (user.rol !== "ADMIN") {
      return NextResponse.json({ error: "Solo ADMIN" }, { status: 403 });
    }

    const { id } = await params;
    const idUsuario = parseId(id);
    if (idUsuario == null) {
      return NextResponse.json({ error: "id invalido" }, { status: 400 });
    }

    const body = await req.json();

    // Auto-protección: el ADMIN no puede cambiar su propio Rol ni Estado por esta ruta.
    if (idUsuario === user.id) {
      if (body.Rol != null && body.Rol !== "ADMIN") {
        return NextResponse.json(
          { error: "No puedes cambiar tu propio rol" },
          { status: 400 },
        );
      }
      if (body.Estado === 0) {
        return NextResponse.json(
          { error: "No puedes desactivarte a ti mismo" },
          { status: 400 },
        );
      }
    }

    await usuarioService.update(idUsuario, user.idTenant, {
      Nombre: body.Nombre,
      Password: body.Password || undefined,
      Rol: body.Rol,
      IdNegocio: body.IdNegocio,
      Estado: body.Estado,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (user.rol !== "ADMIN") {
      return NextResponse.json({ error: "Solo ADMIN" }, { status: 403 });
    }

    const { id } = await params;
    const idUsuario = parseId(id);
    if (idUsuario == null) {
      return NextResponse.json({ error: "id invalido" }, { status: 400 });
    }

    if (idUsuario === user.id) {
      return NextResponse.json(
        { error: "No puedes desactivarte a ti mismo" },
        { status: 400 },
      );
    }

    await usuarioService.softDelete(idUsuario, user.idTenant);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
