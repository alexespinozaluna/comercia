import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/api-auth";
import { documentoService } from "@/services/documento-service";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const width = parseInt(searchParams.get("width") ?? "384");
    const text = await documentoService.getTicketText(parseInt(id), width);
    return NextResponse.json({ data: text });
  } catch (err) {
    console.error("GET /api/ticket/[id] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
