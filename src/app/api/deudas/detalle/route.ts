import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { documentoService } from "@/services/documento-service";

export const GET = withAuth(async (req, { user }) => {
  // ?idCliente=N → filtra solo deudas de ese cliente. Sin el param → todas las del tenant.
  const idClienteParam = req.nextUrl.searchParams.get("idCliente");
  const idCliente = idClienteParam ? Number(idClienteParam) : undefined;
  const idClienteValido = idCliente != null && !Number.isNaN(idCliente) ? idCliente : undefined;

  const data = await documentoService.getDeudaDetalle(user.idTenant, idClienteValido, user.idNegocio);
  return NextResponse.json({ data });
});
