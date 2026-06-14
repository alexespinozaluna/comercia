import { NextResponse } from "next/server";
import { withAuth, ApiError } from "@/lib/api-handler";
import { PERMISOS } from "@/lib/permisos";
import { cajaService } from "@/services/caja-service";
import { documentoService } from "@/services/documento-service";
import { getSupabaseServer } from "@/lib/supabase-server";
import { auditCreate } from "@/lib/audit";
import { TipoDoc } from "@/lib/tipo-documento";

// Lista de saldos a favor activos (tipo 4 con Saldo > 0) para agregar por cliente.
export const GET = withAuth(async (req, { user }) => {
  const idCliente = Number(req.nextUrl.searchParams.get("idCliente")) || undefined;
  const data = await documentoService.getSaldosFavor(user.idTenant, undefined, idCliente);
  return NextResponse.json({ data });
});

// Registra un saldo a favor (anticipo) de un cliente: un Documento tipo 4 con
// Saldo = Total (= crédito disponible). No toca deudas. Es dinero recibido →
// se vincula a la caja activa para el arqueo, igual que un abono/gasto.
export const POST = withAuth(
  async (req, { user }) => {
    // Validar caja abierta (de la sucursal activa)
    const caja = await cajaService.getCajaAbierta(user.idTenant, user.idNegocio);
    if (!caja) {
      throw new ApiError(400, "No hay caja abierta");
    }

    const body = await req.json();
    const { IdCliente, FechaEmision, Concepto, Total, IdMetodoPago } = body;

    if (!IdCliente || IdCliente <= 0) {
      throw new ApiError(400, "Cliente requerido");
    }
    if (!FechaEmision || Total == null || Total <= 0) {
      throw new ApiError(400, "FechaEmision y monto requeridos");
    }

    const { data, error } = await getSupabaseServer()
      .from("Documento")
      .insert(
        auditCreate(user.id, {
          FechaEmision,
          Descripcion: Concepto ?? "Saldo a favor",
          Concepto: Concepto ?? "Saldo a favor",
          Total,
          bCredito: false,
          IdCliente,
          IdClienteDireccion: null,
          DireccionEntrega: null,
          TotalAbono: 0,
          IdTipoDocumento: TipoDoc.SALDO_FAVOR, // saldo a favor
          Saldo: Total, // crédito disponible (Fase 2: se consume)
          IdMetodoPago: IdMetodoPago ?? null,
          IdCaja: caja.id,
          IdTenant: user.idTenant,
          IdNegocio: user.idNegocio,
          Estado: 1,
        }),
      )
      .select()
      .single();

    if (error) throw new ApiError(500, error.message);

    return NextResponse.json({ data });
  },
  { roles: PERMISOS.COBRANZA },
);
