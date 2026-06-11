import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, requireRole } from "@/lib/api-auth";
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
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const data = await negocioService.listByTenant(user.idTenant);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/negocio error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PUT: edita los datos de un negocio del tenant (ADMIN/SUPERVISOR).
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    requireRole(user, ["ADMIN", "SUPERVISOR"]);

    const body = await req.json();
    const { id, Nombre, Direccion, Telefono, Logo, Locale, Decimales, SimboloMoneda } = body;
    if (!id) {
      return NextResponse.json({ error: "id requerido" }, { status: 400 });
    }
    if (Locale != null && !esLocaleValido(Locale)) {
      return NextResponse.json({ error: "Locale inválido" }, { status: 400 });
    }
    if (Decimales != null && !esDecimalesValido(Decimales)) {
      return NextResponse.json({ error: "Decimales inválido (0 o 2)" }, { status: 400 });
    }
    const simbolo = typeof SimboloMoneda === "string" ? SimboloMoneda.trim() : "";
    if (simbolo.length > SIMBOLO_MAX_LEN) {
      return NextResponse.json(
        { error: `SimboloMoneda excede ${SIMBOLO_MAX_LEN} caracteres` },
        { status: 400 },
      );
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
