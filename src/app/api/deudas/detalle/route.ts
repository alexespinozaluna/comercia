import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/api-auth";
import { documentoService } from "@/services/documento-service";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // ?idCliente=N → filtra solo deudas de ese cliente. Sin el param → todas las del tenant.
    const idClienteParam = req.nextUrl.searchParams.get("idCliente");
    const idCliente = idClienteParam ? Number(idClienteParam) : undefined;
    const idClienteValido = idCliente != null && !Number.isNaN(idCliente) ? idCliente : undefined;

    const data = await documentoService.getDeudaDetalle(user.idTenant, idClienteValido);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/deudas/detalle error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
