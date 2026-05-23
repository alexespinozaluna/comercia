import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, requireRole } from "@/lib/api-auth";
import { clienteService } from "@/services/cliente-service";
import { getSupabaseServer } from "@/lib/supabase-server";
import { ClienteDireccion } from "@/types/database";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const data = await clienteService.getAllWithDirecciones(user.idTenant);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/clientes error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    requireRole(user, ["ADMIN", "CAJERO", "VENDEDOR", "COBRANZA", "SUPERVISOR"]);

    const body = await req.json();
    const { Nombre, NroTelefono, TipoDocumento, NroDocumento, Comentario, ClienteDireccion: direcciones } = body;
    if (!Nombre) {
      return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
    }

    // Insert cliente
    const { data: clienteData, error: clienteErr } = await getSupabaseServer()
      .from("Cliente")
      .insert({
        Nombre,
        NroTelefono: NroTelefono ?? null,
        TipoDocumento: TipoDocumento ?? null,
        NroDocumento: NroDocumento ?? null,
        Comentario: Comentario ?? null,
        IdTenant: user.idTenant,
        Estado: 1,
      })
      .select()
      .single();

    if (clienteErr || !clienteData) {
      console.error("POST /api/clientes insert error:", clienteErr);
      return NextResponse.json({ error: clienteErr?.message || "Error creando cliente" }, { status: 500 });
    }

    const idCliente = (clienteData as { id: number }).id;

    // Insert direcciones
    if (direcciones && direcciones.length > 0) {
      const addData = direcciones.map((d: ClienteDireccion) => ({
        Direccion: d.Direccion,
        Telefono: d.Telefono ?? null,
        Contacto: d.Contacto,
        bPrincipal: d.bPrincipal ?? false,
        IdCliente: idCliente,
        IdTenant: user.idTenant,
        Estado: 1,
      }));
      const { error: dirErr } = await getSupabaseServer().from("ClienteDireccion").insert(addData);
      if (dirErr) {
        console.error("POST /api/clientes direcciones error:", dirErr);
        // No hacemos rollback; log para debugging
      }
    }

    return NextResponse.json({ data: clienteData });
  } catch (err) {
    console.error("POST /api/clientes error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
