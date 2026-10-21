import { NextRequest, NextResponse } from "next/server";
import { linkPublicoService } from "@/services/link-publico-service";
import { documentoService } from "@/services/documento-service";
import { negocioService } from "@/services/negocio-service";
import type { Negocio } from "@/types/database";

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

    const [deudas, sucursales] = await Promise.all([
      // getDeudaDetalle(tenantId, idCliente) — orden correcto de argumentos.
      // Sin negocioId: el link es por cliente y abarca todas las sucursales.
      documentoService.getDeudaDetalle(link.IdTenant, link.IdRecurso),
      // Sucursales del tenant del link (ya no global LIMIT 1 — corrige fuga multi-tenant).
      negocioService.listByTenant(link.IdTenant),
    ]);

    // Sucursales a las que pertenecen las deudas; sin IdNegocio → principal.
    const principal = sucursales[0] ?? null;
    const ids = new Set(deudas.map((d) => d.IdNegocio ?? principal?.id));
    const involucradas = sucursales.filter((n) => ids.has(n.id));
    // Encabezado/formato: la sucursal de las deudas si es una sola.
    const negocio = involucradas.length === 1 ? involucradas[0] : principal;

    // Endpoint anónimo: solo los campos que usa la página pública (sin
    // IdTenant, auditoría, etc.).
    const publico = (n: Negocio) => ({
      id: n.id,
      Nombre: n.Nombre,
      Locale: n.Locale,
      Decimales: n.Decimales,
      SimboloMoneda: n.SimboloMoneda,
      DatosTransferencia: n.DatosTransferencia,
    });

    return NextResponse.json({
      data: {
        deudas,
        negocio: negocio && publico(negocio),
        sucursales: involucradas.map(publico),
      },
    });
  } catch (err) {
    console.error("GET /api/deudas/publica error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
