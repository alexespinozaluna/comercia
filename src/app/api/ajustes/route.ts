import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, requireRole } from "@/lib/api-auth";
import { cajaService } from "@/services/caja-service";
import { productoService } from "@/services/producto-service";
import { kardexService } from "@/services/kardex-service";
import { getSupabaseServer } from "@/lib/supabase-server";
import { auditCreate, auditUpdate } from "@/lib/audit";
import { TipoDoc } from "@/lib/tipo-documento";
import { TIPO_MOVIMIENTO } from "@/types/database";
import type { OperacionTipo } from "@/types/database";

const MOTIVOS_BAJA = ["Merma", "Vencimiento", "Daño", "Robo", "Ajuste de Inventario"] as const;
const MOTIVOS_INVENTARIO = ["Inventario Fisico", "Reconteo"] as const;

type AjusteMode = "baja" | "inventario";

interface AjusteBody {
  mode: AjusteMode;
  IdProducto: number;
  Cantidad: number;
  Motivo: string;
  Observacion?: string;
}

/** Map baja motivo to TipoMovimiento ID */
function getTipoMovimientoForBaja(motivo: string): number {
  if (motivo === "Vencimiento") return TIPO_MOVIMIENTO.VENCIMIENTO; // 5
  return TIPO_MOVIMIENTO.MERMA_DANO; // 4 (Merma, Daño, Robo, Ajuste de Inventario)
}

/** Fetch Operacion from TipoMovimiento table */
async function getOperacion(tipoMovimiento: number): Promise<OperacionTipo> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("TipoMovimiento")
    .select("Operacion")
    .eq("Id", tipoMovimiento)
    .single();
  return (data?.Operacion as OperacionTipo) ?? "SALIDA";
}

// Listado de ajustes de inventario (tipos 3-6) del tenant/sucursal activos,
// filtrado por rango de fechas. Solo ADMIN/SUPERVISOR (igual que el POST).
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    requireRole(user, ["ADMIN", "SUPERVISOR"]);

    const { searchParams } = new URL(req.url);
    const fechaInicio = searchParams.get("fechaInicio") ?? undefined;
    const fechaFin = searchParams.get("fechaFin") ?? undefined;
    const tipo = searchParams.get("tipo");
    const tipos = tipo ? [parseInt(tipo, 10)] : undefined;

    const data = await kardexService.getAjustes(
      user.idTenant,
      user.idNegocio,
      fechaInicio,
      fechaFin,
      tipos,
    );
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof Error && err.message === "Forbidden") {
      return NextResponse.json({ error: "No tiene permisos para esta accion" }, { status: 403 });
    }
    console.error("GET /api/ajustes error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    requireRole(user, ["ADMIN", "SUPERVISOR"]);

    const caja = await cajaService.getCajaAbierta(user.idTenant, user.idNegocio);
    if (!caja) {
      return NextResponse.json({ error: "No hay caja abierta" }, { status: 400 });
    }

    const body: AjusteBody = await req.json();
    const { mode = "baja", IdProducto, Cantidad, Motivo, Observacion } = body;

    if (!IdProducto || IdProducto <= 0) {
      return NextResponse.json({ error: "Producto requerido" }, { status: 400 });
    }

    // Validate motivo based on mode
    const validMotivos: readonly string[] = mode === "inventario" ? MOTIVOS_INVENTARIO : MOTIVOS_BAJA;
    if (!Motivo || !validMotivos.includes(Motivo)) {
      return NextResponse.json({ error: "Motivo no valido" }, { status: 400 });
    }

    const fechaEmision = new Date().toISOString();

    // Fetch product — getById con sucursal sobrescribe Cantidad con el stock
    // de ProductoStock de la sucursal activa (catálogo compartido, stock por sucursal).
    const producto = await productoService.getById(IdProducto, user.idTenant, user.idNegocio);
    if (!producto) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }
    if (producto.Cantidad == null) {
      return NextResponse.json({ error: "Este producto no rastrea stock" }, { status: 400 });
    }

    const stockAnterior = producto.Cantidad;
    let tipoMovimiento: number;
    let cantidadMovimiento: number;
    let stockNuevo: number;
    let conceptoDocumento: string;

    if (mode === "inventario") {
      // Physical inventory: user enters counted quantity
      // Always uses INVENTARIO_FISICO (type 6, Operacion: Ajuste)
      // If positive diff → stock increases; if negative → stock decreases
      // If zero → no movement needed
      const cantidadContada = Cantidad;
      if (cantidadContada < 0) {
        return NextResponse.json({ error: "La cantidad contada no puede ser negativa" }, { status: 400 });
      }

      const diferencia = cantidadContada - stockAnterior;

      if (diferencia === 0) {
        return NextResponse.json({ error: "No hay diferencia entre el stock contado y el actual" }, { status: 400 });
      }

      tipoMovimiento = TIPO_MOVIMIENTO.INVENTARIO_FISICO; // 6
      cantidadMovimiento = Math.abs(diferencia);
      stockNuevo = cantidadContada;
      conceptoDocumento = `Inventario Fisico: ${Motivo}${Observacion ? ` - ${Observacion}` : ""}`;
    } else {
      // Baja mode: subtract quantity from stock
      // TipoMovimiento depends on motivo (Vencimiento → 5, else → 4)
      if (!Cantidad || Cantidad <= 0) {
        return NextResponse.json({ error: "Cantidad debe ser mayor a 0" }, { status: 400 });
      }
      if (producto.Cantidad < Cantidad) {
        return NextResponse.json({ error: `Stock insuficiente. Disponible: ${producto.Cantidad}` }, { status: 400 });
      }

      tipoMovimiento = getTipoMovimientoForBaja(Motivo);
      cantidadMovimiento = Cantidad;
      stockNuevo = stockAnterior - Cantidad;
      conceptoDocumento = `Baja por ${Motivo}${Observacion ? `: ${Observacion}` : ""}`;
    }

    const operacion: OperacionTipo = await getOperacion(tipoMovimiento);

    const supabase = getSupabaseServer();

    // 1. Create Documento (IdTipoDocumento = TipoDoc.AJUSTE)
    const { data: docData, error: docError } = await supabase
      .from("Documento")
      .insert(
        auditCreate(user.id, {
          FechaEmision: fechaEmision,
          Descripcion: conceptoDocumento,
          Concepto: Motivo,
          Total: 0,
          bCredito: false,
          IdCliente: null,
          IdClienteDireccion: null,
          DireccionEntrega: null,
          TotalAbono: 0,
          IdTipoDocumento: TipoDoc.AJUSTE,
          Saldo: 0,
          IdMetodoPago: null,
          IdTenant: user.idTenant,
          IdNegocio: user.idNegocio,
          Estado: 1,
        }),
      )
      .select()
      .single();

    if (docError || !docData) {
      console.error("Error creating documento:", docError);
      return NextResponse.json({ error: "Error al crear documento" }, { status: 500 });
    }

    // 2. Create DocumentoItem
    const { error: itemError } = await supabase
      .from("DocumentoItem")
      .insert(
        auditCreate(user.id, {
          IdProducto,
          Descripcion: producto.Nombre,
          Cantidad: cantidadMovimiento,
          PrecioVenta: producto.PrecioVenta,
          MontoAbono: 0,
          Total: cantidadMovimiento * producto.PrecioVenta,
          IdDocumento: docData.id,
          IdDocumentoRef: null,
          IdTenant: user.idTenant,
          IdNegocio: user.idNegocio,
          Estado: 1,
        }),
      );

    if (itemError) {
      console.error("Error creating documento item:", itemError);
      await supabase.from("Documento").delete().eq("id", docData.id);
      return NextResponse.json({ error: "Error al crear item de documento" }, { status: 500 });
    }

    // 3. Create ProductoMovimiento
    const observacionMov = mode === "inventario"
      ? `Inventario: conteo=${Cantidad}, anterior=${stockAnterior}, diferencia=${stockNuevo > stockAnterior ? "+" : ""}${stockNuevo - stockAnterior}${Observacion ? ` - ${Observacion}` : ""}`
      : conceptoDocumento;

    const { error: movError } = await supabase
      .from("ProductoMovimiento")
      .insert(
        auditCreate(user.id, {
          IdProducto,
          TipoMovimiento: tipoMovimiento,
          Cantidad: cantidadMovimiento,
          StockAnterior: stockAnterior,
          StockNuevo: stockNuevo,
          IdDocumento: docData.id,
          Observacion: observacionMov,
          Fecha: fechaEmision,
          IdTenant: user.idTenant,
          IdNegocio: user.idNegocio,
        }),
      );

    if (movError) {
      console.error("Error creating movimiento:", movError);
      return NextResponse.json({ error: "Error al registrar movimiento" }, { status: 500 });
    }

    // 4. Actualizar stock de la sucursal activa (ProductoStock). Si la sesión
    //    no trae sucursal (token previo), fallback legacy a Producto.Cantidad.
    const stockUpd =
      user.idNegocio != null
        ? await supabase.from("ProductoStock").upsert(
            auditCreate(user.id, {
              IdProducto,
              IdNegocio: user.idNegocio,
              IdTenant: user.idTenant,
              Cantidad: stockNuevo,
            }),
            { onConflict: "IdProducto,IdNegocio" },
          )
        : await supabase
            .from("Producto")
            .update(auditUpdate(user.id, { Cantidad: stockNuevo }))
            .eq("id", IdProducto)
            .eq("IdTenant", user.idTenant);

    if (stockUpd.error) {
      console.error("Error updating product stock:", stockUpd.error);
      return NextResponse.json({ error: "Error al actualizar stock" }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        id: docData.id,
        stockAnterior,
        stockNuevo,
        tipoMovimiento,
        operacion,
        cantidadMovimiento,
      },
    }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "Forbidden") {
      return NextResponse.json({ error: "No tiene permisos para esta accion" }, { status: 403 });
    }
    console.error("POST /api/ajustes error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}