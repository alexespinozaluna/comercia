import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, requireRole } from "@/lib/api-auth";
import { documentoService } from "@/services/documento-service";
import { cajaService } from "@/services/caja-service";

const MAX_FIELD_LEN = 500;

function truncateField(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_FIELD_LEN ? trimmed.substring(0, MAX_FIELD_LEN) : trimmed;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const fechaIni = searchParams.get("fechaIni") ?? "";
    const fechaFin = searchParams.get("fechaFin") ?? "";
    const bCredito = searchParams.get("bCredito") === "true";
    const idCliente = parseInt(searchParams.get("idCliente") ?? "0");

    const data = await documentoService.getVentas(fechaIni, fechaFin, bCredito, idCliente, user.idTenant);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/ventas error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    requireRole(user, ["ADMIN", "CAJERO", "VENDEDOR", "SUPERVISOR"]);

    // Validate caja abierta
    const caja = await cajaService.getCajaAbierta(user.idTenant);
    if (!caja) {
      return NextResponse.json({ error: "No hay caja abierta" }, { status: 400 });
    }

    const body = await req.json();
    const { FechaEmision, Descripcion, Concepto, Total, bCredito, IdCliente, IdClienteDireccion, DireccionEntrega, IdMetodoPago, DocumentoItem: items } = body;

    if (!FechaEmision || Total == null) {
      return NextResponse.json({ error: "FechaEmision y Total requeridos" }, { status: 400 });
    }

    const doc = {
      FechaEmision,
      Descripcion: truncateField(Descripcion),
      Concepto: truncateField(Concepto),
      Total,
      bCredito: !!bCredito,
      IdCliente: IdCliente && IdCliente !== 0 ? IdCliente : null,
      IdClienteDireccion: IdClienteDireccion ?? null,
      DireccionEntrega: DireccionEntrega ?? null,
      IdTipoDocumento: 1,
      Saldo: bCredito ? Total : 0,
      IdMetodoPago: IdMetodoPago ?? null,
    };

    // Validate: if items exist, Descripcion should have been auto-generated
    if (items?.length > 0 && !doc.Descripcion) {
      return NextResponse.json({ error: "Descripcion es requerida cuando hay items" }, { status: 400 });
    }

    const createdDoc = await documentoService.crearVentaConItems(
      doc,
      items ?? [],
      user.idTenant,
      user.id
    );

    return NextResponse.json({ data: createdDoc });
  } catch (err) {
    console.error("POST /api/ventas error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}