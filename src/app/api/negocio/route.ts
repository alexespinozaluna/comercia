import { NextResponse } from "next/server";
import { withAuth, ApiError } from "@/lib/api-handler";
import { PERMISOS } from "@/lib/permisos";
import { negocioService } from "@/services/negocio-service";
import {
  esLocaleValido,
  DEFAULT_LOCALE,
  esDecimalesValido,
  DEFAULT_DECIMALES,
  SIMBOLO_MAX_LEN,
} from "@/types/locale";

// GET: lista de negocios (sucursales) del tenant. Accesible a cualquier
// usuario autenticado (el selector de sucursal lo necesita).
export const GET = withAuth(async (_req, { user }) => {
  const data = await negocioService.listByTenant(user.idTenant);
  return NextResponse.json({ data });
});

// PUT: edita los datos de un negocio del tenant (ADMIN/SUPERVISOR).
export const PUT = withAuth(
  async (req, { user }) => {
    const body = await req.json();
    const { id, Nombre, Direccion, Telefono, Logo, Locale, Decimales, SimboloMoneda } = body;
    if (!id) {
      throw new ApiError(400, "id requerido");
    }
    if (Locale != null && !esLocaleValido(Locale)) {
      throw new ApiError(400, "Locale inválido");
    }
    if (Decimales != null && !esDecimalesValido(Decimales)) {
      throw new ApiError(400, "Decimales inválido (0 o 2)");
    }
    const simbolo = typeof SimboloMoneda === "string" ? SimboloMoneda.trim() : "";
    if (simbolo.length > SIMBOLO_MAX_LEN) {
      throw new ApiError(400, `SimboloMoneda excede ${SIMBOLO_MAX_LEN} caracteres`);
    }
    const ok = await negocioService.update(
      id,
      user.idTenant,
      {
        Nombre: Nombre ?? null,
        Direccion: Direccion ?? null,
        Telefono: Telefono ?? null,
        Logo: Logo ?? null,
        Locale: Locale ?? DEFAULT_LOCALE,
        Decimales: Decimales ?? DEFAULT_DECIMALES,
        SimboloMoneda: simbolo,
      },
      user.id,
    );
    return NextResponse.json({ ok });
  },
  { roles: PERMISOS.ADMINISTRACION, exposeErrors: true },
);
