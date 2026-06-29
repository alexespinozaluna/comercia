import { NextResponse } from "next/server";
import { withAuth, ApiError } from "@/lib/api-handler";
import { PERMISOS } from "@/lib/permisos";
import { documentoService } from "@/services/documento-service";
import { cajaService } from "@/services/caja-service";
import { TipoDoc } from "@/lib/tipo-documento";

const MAX_FIELD_LEN = 500;

function truncateField(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_FIELD_LEN
    ? trimmed.substring(0, MAX_FIELD_LEN)
    : trimmed;
}

export const GET = withAuth(async (req, { user }) => {
  const { searchParams } = new URL(req.url);
  const fechaIni = searchParams.get("fechaIni") ?? "";
  const fechaFin = searchParams.get("fechaFin") ?? "";
  const bCredito = searchParams.get("bCredito") === "true";
  const idCliente = parseInt(searchParams.get("idCliente") ?? "0");
  const id = searchParams.get("id")
    ? parseInt(searchParams.get("id") ?? "0")
    : undefined;

  const data = await documentoService.getVentas(
    fechaIni,
    fechaFin,
    bCredito,
    idCliente,
    user.idTenant,
    id,
    user.idNegocio,
  );
  return NextResponse.json({ data });
});

export const POST = withAuth(
  async (req, { user }) => {
    // Validate caja abierta (de la sucursal activa)
    const caja = await cajaService.getCajaAbierta(user.idTenant, user.idNegocio);
    if (!caja) {
      throw new ApiError(400, "No hay caja abierta");
    }

    const body = await req.json();
    const {
      FechaEmision,
      Descripcion,
      Concepto,
      Importe,
      Descuento,
      Total,
      bCredito,
      IdCliente,
      IdClienteDireccion,
      DireccionEntrega,
      IdMetodoPago,
      DocumentoItem: items,
    } = body;

    if (!FechaEmision || Total == null) {
      throw new ApiError(400, "FechaEmision y Total requeridos");
    }

    // Descuento global (≥ 0, ≤ Importe). El RPC recalcula el bruto desde los
    // items y vuelve a validar; esto es un guard temprano y amigable.
    const importe = Importe ?? Total;
    const descuento = Descuento ?? 0;
    if (descuento < 0 || descuento > importe + 0.01) {
      throw new ApiError(400, "Descuento inválido");
    }

    const doc = {
      FechaEmision,
      Descripcion: truncateField(Descripcion),
      Concepto: truncateField(Concepto),
      Importe: importe,
      Descuento: descuento,
      Total,
      bCredito: !!bCredito,
      IdCliente: IdCliente && IdCliente !== 0 ? IdCliente : null,
      IdClienteDireccion: IdClienteDireccion ?? null,
      DireccionEntrega: DireccionEntrega ?? null,
      IdTipoDocumento: TipoDoc.VENTA,
      Saldo: bCredito ? Total : 0,
      IdMetodoPago: IdMetodoPago ?? null,
    };

    // Validate: if items exist, Descripcion should have been auto-generated
    if (items?.length > 0 && !doc.Descripcion) {
      throw new ApiError(400, "Descripcion es requerida cuando hay items");
    }

    const createdDoc = await documentoService.guardarVentaConItems(
      0,
      doc,
      items ?? [],
      [],
      user.idTenant,
      user.id,
      user.idNegocio,
    );

    // Vincular el documento creado a la caja activa (para arqueo).
    // UPDATE separado para no tocar el RPC guardar_venta_con_items.
    if (createdDoc?.id) {
      await documentoService.setIdCaja(createdDoc.id, caja.id, user.idTenant, user.id);
      createdDoc.IdCaja = caja.id;
    }

    return NextResponse.json({ data: createdDoc });
  },
  { roles: PERMISOS.VENTAS_Y_CATALOGO },
);
