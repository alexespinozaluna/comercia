import { NextRequest, NextResponse } from "next/server";
import { linkPublicoService } from "@/services/link-publico-service";

// Pública (sin auth): valida un token de link público.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const link = await linkPublicoService.validar(token);
    if (!link) {
      return NextResponse.json({ error: "Token inválido o expirado" }, { status: 404 });
    }
    return NextResponse.json({ data: link });
  } catch (err) {
    console.error("GET /api/link-publico/validar error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
