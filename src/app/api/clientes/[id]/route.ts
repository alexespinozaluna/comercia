import { NextResponse } from "next/server";
import { withAuth, ApiError } from "@/lib/api-handler";
import { PERMISOS } from "@/lib/permisos";
import { clienteService } from "@/services/cliente-service";
import { getSupabaseServer } from "@/lib/supabase-server";
import { auditCreate, auditUpdate } from "@/lib/audit";
import { ClienteDireccion } from "@/types/database";

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  const data = await clienteService.getByIdWithDirecciones(parseInt(params.id), user.idTenant);
  return NextResponse.json({ data });
});

export const PUT = withAuth<{ id: string }>(
  async (req, { user, params }) => {
    const idCliente = parseInt(params.id);
    const body = await req.json();
    const { Nombre, NroTelefono, TipoDocumento, NroDocumento, Comentario, ClienteDireccion: direcciones } = body;

    if (!Nombre) {
      throw new ApiError(400, "Nombre requerido");
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

    if (error) throw new ApiError(500, error.message);

    const result = data as { ok?: boolean; error?: string } | null;
    if (result && result.ok === false) {
      throw new ApiError(404, result.error ?? "Cliente no encontrado");
    }

    return NextResponse.json({ ok: true });
  },
  { roles: PERMISOS.CUALQUIER_OPERADOR },
);

export const DELETE = withAuth<{ id: string }>(
  async (_req, { user, params }) => {
    const idCliente = parseInt(params.id);

    // Verificar que no tenga documentos activos
    const { data: docs, error: docErr } = await getSupabaseServer()
      .from("Documento")
      .select("id")
      .eq("IdCliente", idCliente)
      .eq("IdTenant", user.idTenant)
      .eq("Estado", 1)
      .limit(1);

    if (docErr) throw new ApiError(500, docErr.message);

    if (docs && docs.length > 0) {
      throw new ApiError(400, "No se puede eliminar: el cliente tiene documentos activos");
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

    if (error) throw new ApiError(500, error.message);

    return NextResponse.json({ ok: true });
  },
  { roles: PERMISOS.ADMINISTRACION },
);
