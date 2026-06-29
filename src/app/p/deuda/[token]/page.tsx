import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DeudaDetalle, Negocio } from "@/types/database";
import { numToString, formatNumero, fechaString, extraerIniciales, parseDateOnly } from "@/lib/format";
import { simboloEfectivo, DEFAULT_LOCALE } from "@/types/locale";

/** Formato explícito del negocio dueño del link (server: sin setters). */
function fmtDeNegocio(negocio: Negocio | null) {
  if (!negocio) return undefined;
  return {
    locale: negocio.Locale,
    decimales: negocio.Decimales,
    simbolo: simboloEfectivo(negocio.SimboloMoneda, negocio.Locale ?? DEFAULT_LOCALE),
  };
}

// Dinámica: depende del token y de los headers del request.
export const dynamic = "force-dynamic";

interface DeudaPublicaData {
  deudas: DeudaDetalle[];
  negocio: Negocio | null;
}

const SIN_DIRECCION = "Sin dirección";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;

  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${proto}://${host}` : "";

  const res = await fetch(`${origin}/api/deudas/publica/${token}`, {
    cache: "no-store",
  });
  if (!res.ok) return {};

  const { data } = await res.json();
  const deudas = data?.deudas as DeudaDetalle[] | undefined;
  const negocio = data?.negocio as Negocio | null;
  if (!deudas?.length) return {};

  const cliente = deudas[0];
  const totalDeuda = deudas.reduce((s, d) => s + Number(d.Saldo), 0);
  const nombreCliente = cliente.NomCliente ?? "Cliente";
  const nombreNegocio = negocio?.Nombre ?? "Comercia";

  const title = `Deuda pendiente — ${nombreCliente}`;
  const description = `${numToString(totalDeuda, undefined, fmtDeNegocio(negocio))} · ${nombreNegocio}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: nombreNegocio,
    },
  };
}

export default async function DeudaPublicaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Origin dinámico desde los headers del request (sin variable de entorno).
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${proto}://${host}` : "";

  const res = await fetch(`${origin}/api/deudas/publica/${token}`, { cache: "no-store" });
  if (!res.ok) notFound();

  const { data } = await res.json();
  const { deudas, negocio } = (data ?? {}) as DeudaPublicaData;
  if (!deudas?.length) notFound();

  // Agrupar por dirección de entrega.
  const grupos = new Map<string, DeudaDetalle[]>();
  for (const d of deudas) {
    const key = d.DireccionEntrega?.trim() || SIN_DIRECCION;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(d);
  }

  const totalDeuda = deudas.reduce((s, d) => s + Number(d.Saldo), 0);
  const totalDescuento = deudas.reduce((s, d) => s + Number(d.Descuento ?? 0), 0);
  const cliente = deudas[0];
  const fmt = fmtDeNegocio(negocio);

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      {/* Header cliente: nombre + teléfono (dos datos del cliente) y total */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-full bg-brand-surface flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-brand">
              {extraerIniciales(cliente.NomCliente ?? "")}
            </span>
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-foreground truncate">
              {cliente.NomCliente ?? "Cliente"}
            </h1>
            {(cliente.NroDocumento || cliente.NroTelefono) && (
              <p className="text-xs text-muted-foreground truncate">
                {[cliente.NroDocumento, cliente.NroTelefono].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-red-600 text-[10px] uppercase font-semibold">Debe</p>
          <p className="text-red-600 font-extrabold text-lg tabular-nums">
            {numToString(totalDeuda, undefined, fmt)}
          </p>
          {totalDescuento > 0 && (
            <p className="text-green-600 text-[11px] font-semibold tabular-nums">
              Ahorro −{numToString(totalDescuento, undefined, fmt)}
            </p>
          )}
        </div>
      </div>

      {/* Grupos por dirección */}
      {Array.from(grupos.entries()).map(([direccion, items]) => {
        const subtotal = items.reduce((s, d) => s + Number(d.Saldo), 0);
        return (
          <div
            key={direccion}
            className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 overflow-hidden"
          >
            {/* Header grupo */}
            <div className="flex justify-between items-center px-3 py-2 bg-orange-50 border-b border-border">
              <span className="text-sm font-bold text-orange-800 truncate flex-1">
                {direccion}
              </span>
              <span className="text-sm font-bold text-orange-800 tabular-nums shrink-0 ml-3">
                {numToString(subtotal, undefined, fmt)}
              </span>
            </div>

            {/* Items */}
            <div className="divide-y divide-border/40">
              {items.map((d) => (
                <div
                  key={d.id}
                  className="flex justify-between items-start gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground break-words">
                      {d.Concepto ?? d.Descripcion ?? `Venta #${d.id}`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {fechaString(parseDateOnly(d.FechaEmision))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-red-600 tabular-nums">
                      {numToString(Number(d.Saldo), undefined, fmt)}
                    </div>
                    {Number(d.TotalAbono) > 0 && (
                      <div className="text-xs text-muted-foreground line-through tabular-nums">
                        {numToString(Number(d.Total), undefined, fmt)}
                      </div>
                    )}
                    {Number(d.Descuento) > 0 && (
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        Imp {formatNumero(Number(d.Importe), undefined, fmt)} · Desc −{formatNumero(Number(d.Descuento), undefined, fmt)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground pb-4">
        Reporte generado el {fechaString(new Date())}
      </p>
    </div>
  );
}
