import { NextRequest, NextResponse } from "next/server";
import { linkPublicoService } from "@/services/link-publico-service";
import { documentoService } from "@/services/documento-service";
import { negocioService } from "@/services/negocio-service";

// Pública (sin auth): devuelve los datos de deuda del cliente referenciado por
// el token. El tenant y el cliente salen del link validado en el servidor, así
// que no hay riesgo de fuga entre tenants.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const link = await linkPublicoService.validar(token);

    if (!link || link.TipoRecurso !== "deuda_cliente") {
      return NextResponse.json({ error: "Token inválido" }, { status: 404 });
    }

    const [deudas, negocio] = await Promise.all([
      // getDeudaDetalle(tenantId, idCliente) — orden correcto de argumentos.
      documentoService.getDeudaDetalle(link.IdTenant, link.IdRecurso),
      negocioService.get(),
    ]);

    return NextResponse.json({ data: { deudas, negocio } });
  } catch (err) {
    console.error("GET /api/deudas/publica error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
