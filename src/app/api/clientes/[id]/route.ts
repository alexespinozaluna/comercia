import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, requireRole } from "@/lib/api-auth";
import { PERMISOS } from "@/lib/permisos";
import { clienteService } from "@/services/cliente-service";
import { getSupabaseServer } from "@/lib/supabase-server";
import { auditCreate, auditUpdate } from "@/lib/audit";
import { ClienteDireccion } from "@/types/database";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const data = await clienteService.getByIdWithDirecciones(parseInt(id), user.idTenant);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/clientes/[id] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    requireRole(user, PERMISOS.CUALQUIER_OPERADOR);

    const { id } = await params;
    const idCliente = parseInt(id);
    const body = await req.json();
    const { Nombre, NroTelefono, TipoDocumento, NroDocumento, Comentario, ClienteDireccion: direcciones } = body;

    if (!Nombre) {
      return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
    }

    // Cliente + diff de direcciones en una sola transacción (RPC).
    // El RPC soft-borra las activas ausentes, actualiza las de id > 0 e
    // inserta las de id 0.
    const { data, error } = await getSupabaseServer().rpc("guardar_cliente_con_direcciones", {
      p_id_cliente: idCliente,
      p_cliente: auditUpdate(user.id, {
        Nombre,
        NroTelefono: NroTelefono ?? null,
        TipoDocumento: TipoDocumento ?? null,
        NroDocumento: NroDocumento ?? null,
        Comentario: Comentario ?? null,
      }),
      p_direcciones: ((direcciones ?? []) as ClienteDireccion[]).map((d) =>
        d.id > 0
          ? auditUpdate(user.id, {
              id: d.id,
              Direccion: d.Direccion,
              Telefono: d.Telefono ?? null,
              Contacto: d.Contacto,
              bPrincipal: d.bPrincipal ?? false,
            })
          : auditCreate(user.id, {
              id: 0,
              Direccion: d.Direccion,
              Telefono: d.Telefono ?? null,
              Contacto: d.Contacto,
              bPrincipal: d.bPrincipal ?? false,
            }),
      ),
      p_id_tenant: user.idTenant,
    });

    if (error) {
      console.error("PUT /api/clientes/[id] rpc error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = data as { ok?: boolean; error?: string } | null;
    if (result && result.ok === false) {
      return NextResponse.json({ error: result.error ?? "Cliente no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/clientes/[id] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    requireRole(user, PERMISOS.ADMINISTRACION);

    const { id } = await params;
    const idCliente = parseInt(id);

    // Verificar que no tenga documentos activos
    const { data: docs, error: docErr } = await getSupabaseServer()
      .from("Documento")
      .select("id")
      .eq("IdCliente", idCliente)
      .eq("IdTenant", user.idTenant)
      .eq("Estado", 1)
      .limit(1);

    if (docErr) {
      console.error("DELETE /api/clientes/[id] doc check error:", docErr);
      return NextResponse.json({ error: docErr.message }, { status: 500 });
    }

    if (docs && docs.length > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar: el cliente tiene documentos activos" },
        { status: 400 }
      );
    }

    // Soft delete direcciones primero
    const { error: dirDelErr } = await getSupabaseServer()
      .from("ClienteDireccion")
      .update(auditUpdate(user.id, { Estado: 0 }))
      .eq("IdCliente", idCliente)
      .eq("IdTenant", user.idTenant);

    if (dirDelErr) {
      console.error("DELETE /api/clientes/[id] direcciones error:", dirDelErr);
    }

    // Soft delete cliente
    const { error } = await getSupabaseServer()
      .from("Cliente")
      .update(auditUpdate(user.id, { Estado: 0 }))
      .eq("id", idCliente)
      .eq("IdTenant", user.idTenant);

    if (error) {
      console.error("DELETE /api/clientes/[id] error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/clientes/[id] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
