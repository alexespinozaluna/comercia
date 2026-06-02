import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, requireRole } from "@/lib/api-auth";
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
    requireRole(user, ["ADMIN", "CAJERO", "VENDEDOR", "COBRANZA", "SUPERVISOR"]);

    const { id } = await params;
    const idCliente = parseInt(id);
    const body = await req.json();
    const { Nombre, NroTelefono, TipoDocumento, NroDocumento, Comentario, ClienteDireccion: direcciones } = body;

    if (!Nombre) {
      return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
    }

    // Update cliente
    const { error: updErr } = await getSupabaseServer()
      .from("Cliente")
      .update(
        auditUpdate(user.id, {
          Nombre,
          NroTelefono: NroTelefono ?? null,
          TipoDocumento: TipoDocumento ?? null,
          NroDocumento: NroDocumento ?? null,
          Comentario: Comentario ?? null,
        }),
      )
      .eq("id", idCliente)
      .eq("IdTenant", user.idTenant)
      .eq("Estado", 1);

    if (updErr) {
      console.error("PUT /api/clientes/[id] update error:", updErr);
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    // Fetch current direcciones
    const { data: currentDirecciones, error: fetchErr } = await getSupabaseServer()
      .from("ClienteDireccion")
      .select("*")
      .eq("IdCliente", idCliente)
      .eq("IdTenant", user.idTenant)
      .eq("Estado", 1);

    if (fetchErr) {
      console.error("PUT /api/clientes/[id] fetch direcciones error:", fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const current = (currentDirecciones ?? []) as ClienteDireccion[];
    const newDirecciones = (direcciones ?? []) as ClienteDireccion[];

    const toDelete = current.filter((c) => !newDirecciones.some((n) => n.id === c.id));
    const toUpdate = newDirecciones.filter((n) => current.some((c) => c.id === n.id));
    const toAdd = newDirecciones.filter((n) => !current.some((c) => c.id === n.id));

    // Batch delete (soft)
    if (toDelete.length > 0) {
      const idsToDelete = toDelete.map((d) => d.id);
      const { error: delErr } = await getSupabaseServer()
        .from("ClienteDireccion")
        .update(auditUpdate(user.id, { Estado: 0 }))
        .in("id", idsToDelete)
        .eq("IdTenant", user.idTenant);
      if (delErr) console.error("PUT /api/clientes/[id] delete direcciones error:", delErr);
    }

    // Individual updates
    for (const item of toUpdate) {
      const { id: _id, FechaCreacion, ...updateData } = item as ClienteDireccion & { FechaCreacion?: string };
      const { error: updItemErr } = await getSupabaseServer()
        .from("ClienteDireccion")
        .update(
          auditUpdate(user.id, {
            Direccion: updateData.Direccion,
            Telefono: updateData.Telefono ?? null,
            Contacto: updateData.Contacto,
            bPrincipal: updateData.bPrincipal,
          }),
        )
        .eq("id", item.id)
        .eq("IdTenant", user.idTenant);
      if (updItemErr) console.error("PUT /api/clientes/[id] update direccion error:", updItemErr);
    }

    // Batch insert
    if (toAdd.length > 0) {
      const addData = toAdd.map((d) =>
        auditCreate(user.id, {
          Direccion: d.Direccion,
          Telefono: d.Telefono ?? null,
          Contacto: d.Contacto,
          bPrincipal: d.bPrincipal ?? false,
          IdCliente: idCliente,
          IdTenant: user.idTenant,
          Estado: 1,
        }),
      );
      const { error: addErr } = await getSupabaseServer().from("ClienteDireccion").insert(addData);
      if (addErr) console.error("PUT /api/clientes/[id] insert direcciones error:", addErr);
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
    requireRole(user, ["ADMIN", "SUPERVISOR"]);

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
