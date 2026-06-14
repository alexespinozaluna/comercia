import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, requireRole } from "@/lib/api-auth";
import { PERMISOS } from "@/lib/permisos";
import { clienteService } from "@/services/cliente-service";
import { getSupabaseServer } from "@/lib/supabase-server";
import { auditCreate } from "@/lib/audit";
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
    requireRole(user, PERMISOS.CUALQUIER_OPERADOR);

    const body = await req.json();
    const { Nombre, NroTelefono, TipoDocumento, NroDocumento, Comentario, ClienteDireccion: direcciones } = body;
    if (!Nombre) {
      return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
    }

    // Cliente + direcciones en una sola transacción (RPC).
    const { data, error } = await getSupabaseServer().rpc("guardar_cliente_con_direcciones", {
      p_id_cliente: 0,
      p_cliente: auditCreate(user.id, {
        Nombre,
        NroTelefono: NroTelefono ?? null,
        TipoDocumento: TipoDocumento ?? null,
        NroDocumento: NroDocumento ?? null,
        Comentario: Comentario ?? null,
      }),
      p_direcciones: ((direcciones ?? []) as ClienteDireccion[]).map((d) =>
        auditCreate(user.id, {
          Direccion: d.Direccion,
          Telefono: d.Telefono ?? null,
          Contacto: d.Contacto,
          bPrincipal: d.bPrincipal ?? false,
        }),
      ),
      p_id_tenant: user.idTenant,
    });

    if (error) {
      console.error("POST /api/clientes rpc error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("POST /api/clientes error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
