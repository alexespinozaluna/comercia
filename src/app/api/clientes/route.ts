import { NextResponse } from "next/server";
import { withAuth, ApiError } from "@/lib/api-handler";
import { PERMISOS } from "@/lib/permisos";
import { clienteService } from "@/services/cliente-service";
import { getSupabaseServer } from "@/lib/supabase-server";
import { auditCreate } from "@/lib/audit";
import { ClienteDireccion } from "@/types/database";

export const GET = withAuth(async (_req, { user }) => {
  const data = await clienteService.getAllWithDirecciones(user.idTenant);
  return NextResponse.json({ data });
});

export const POST = withAuth(
  async (req, { user }) => {
    const body = await req.json();
    const { Nombre, NroTelefono, TipoDocumento, NroDocumento, Comentario, ClienteDireccion: direcciones } = body;
    if (!Nombre) {
      throw new ApiError(400, "Nombre requerido");
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

    if (error) throw new ApiError(500, error.message);

    return NextResponse.json({ data });
  },
  { roles: PERMISOS.CUALQUIER_OPERADOR },
);
