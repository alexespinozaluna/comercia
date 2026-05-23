import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/api-auth";
import { negocioService } from "@/services/negocio-service";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const data = await negocioService.get();
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/negocio error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const body = await req.json();
    const { id, Nombre, Direccion, Telefono, Logo } = body;
    if (!id) {
      return NextResponse.json({ error: "id requerido" }, { status: 400 });
    }
    const ok = await negocioService.update(id, {
      Nombre: Nombre ?? null,
      Direccion: Direccion ?? null,
      Telefono: Telefono ?? null,
      Logo: Logo ?? null,
    });
    return NextResponse.json({ ok });
  } catch (err) {
    console.error("PUT /api/negocio error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
