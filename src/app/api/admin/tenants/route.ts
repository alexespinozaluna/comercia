import { NextResponse } from "next/server";
import { withAuth, ApiError } from "@/lib/api-handler";
import { tenantService } from "@/services/tenant-service";
import { ROL_SUPERADMIN } from "@/types/usuario";
import { esLocaleValido, esDecimalesValido, DEFAULT_LOCALE } from "@/types/locale";

const SOLO_SUPERADMIN = [ROL_SUPERADMIN] as const;

export const GET = withAuth(
  async () => {
    const data = await tenantService.list();
    return NextResponse.json({ data });
  },
  { roles: SOLO_SUPERADMIN },
);

export const POST = withAuth(
  async (req, { user }) => {
    const body = await req.json();
    const {
      codigo,
      nombre,
      adminCodigo,
      adminNombre,
      adminPassword,
      negocioNombre,
      locale,
      decimales,
      simbolo,
    } = body;

    if (
      !codigo?.trim() ||
      !nombre?.trim() ||
      !adminCodigo?.trim() ||
      !adminNombre?.trim() ||
      !adminPassword
    ) {
      throw new ApiError(
        400,
        "Código, nombre, y datos del admin (código, nombre, contraseña) son requeridos",
      );
    }
    const localeOk = esLocaleValido(locale) ? locale : DEFAULT_LOCALE;
    const decimalesOk = esDecimalesValido(decimales) ? decimales : 0;

    const id = await tenantService.provisionar(
      {
        codigo,
        nombre,
        adminCodigo,
        adminNombre,
        adminPassword,
        negocioNombre: negocioNombre?.trim() || nombre.trim(),
        locale: localeOk,
        decimales: decimalesOk,
        simbolo: typeof simbolo === "string" ? simbolo.trim() : "",
      },
      user.id,
    );

    return NextResponse.json({ data: { id } });
  },
  { roles: SOLO_SUPERADMIN, exposeErrors: true },
);
