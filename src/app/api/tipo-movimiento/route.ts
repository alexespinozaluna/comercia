import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import type { TipoMovimiento } from "@/types/database";

export async function GET() {
  const supabase = getSupabaseServer();

  const { data, error } = await supabase
    .from("TipoMovimiento")
    .select("*")
    .eq("Estado", 1)
    .order("Id");

  if (error) {
    console.error("Error fetching TipoMovimiento:", error);
    return NextResponse.json({ error: "Error al obtener tipos de movimiento" }, { status: 500 });
  }

  const result: TipoMovimiento[] = (data ?? []).map((row: Record<string, unknown>) => ({
    Id: row.Id as number,
    Descripcion: row.Descripcion as string,
    Operacion: row.Operacion as TipoMovimiento["Operacion"],
    Efecto: row.Efecto as TipoMovimiento["Efecto"],
  }));

  return NextResponse.json({ data: result });
}