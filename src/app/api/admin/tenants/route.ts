import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/api-auth";
import { tenantService } from "@/services/tenant-service";
import { ROL_SUPERADMIN } from "@/types/usuario";
import { esLocaleValido, esDecimalesValido, DEFAULT_LOCALE } from "@/types/locale";

export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.rol !== ROL_SUPERADMIN)
    return NextResponse.json({ error: "Solo SUPERADMIN" }, { status: 403 });

  try {
    const data = await tenantService.list();
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/admin/tenants error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.rol !== ROL_SUPERADMIN)
    return NextResponse.json({ error: "Solo SUPERADMIN" }, { status: 403 });

  try {
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
      return NextResponse.json(
        { error: "Código, nombre, y datos del admin (código, nombre, contraseña) son requeridos" },
        { status: 400 },
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
