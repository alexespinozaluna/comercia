import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DeudaDetalle, Negocio } from "@/types/database";
import { numToString, fechaString } from "@/lib/format";

// Dinámica: depende del token y de los headers del request.
export const dynamic = "force-dynamic";

interface DeudaPublicaData {
  deudas: DeudaDetalle[];
  negocio: Negocio | null;
}

const SIN_DIRECCION = "Sin dirección";

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
  const totalAbono = deudas.reduce((s, d) => s + Number(d.TotalAbono ?? 0), 0);
  const cliente = deudas[0];

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      {/* Header negocio */}
      {negocio && (
        <div className="text-center py-4 border-b border-border">
          <h1 className="text-xl font-extrabold text-brand">{negocio.Nombre}</h1>
          {negocio.Direccion && (
            <p className="text-xs text-muted-foreground">{negocio.Direccion}</p>
          )}
          {negocio.Telefono && (
            <p className="text-xs text-muted-foreground">Tel: {negocio.Telefono}</p>
          )}
        </div>
      )}

      {/* Info cliente */}
      <div>
        <h2 className="text-lg font-bold text-foreground">{cliente.NomCliente}</h2>
        {cliente.NroTelefono && (
          <p className="text-sm text-muted-foreground">{cliente.NroTelefono}</p>
        )}
      </div>

      {/* Cards resumen */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-red-50 rounded-lg p-3">
          <p className="text-xs text-red-600 font-semibold uppercase">Deuda</p>
          <p className="text-2xl font-extrabold text-red-600 tabular-nums truncate">
            {numToString(totalDeuda)}
          </p>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <p className="text-xs text-green-600 font-semibold uppercase">Abono</p>
          <p className="text-2xl font-extrabold text-green-600 tabular-nums truncate">
            {numToString(totalAbono)}
          </p>
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
            <div className="flex justify-between items-center px-3 py-2 bg-orange-50 border-b border-border">
              <span className="text-sm font-bold text-orange-800 truncate flex-1">
                {direccion}
              </span>
              <span className="text-sm font-bold text-orange-800 tabular-nums shrink-0 ml-3">
                {numToString(subtotal)}
              </span>
            </div>
            {/* Ítems del grupo en formato tabla */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-orange-200 text-orange-800">
                    <th className="text-left py-1.5 px-2 font-semibold w-6">#</th>
                    <th className="text-left py-1.5 px-2 font-semibold whitespace-nowrap">Fecha</th>
                    <th className="text-left py-1.5 px-2 font-semibold">Descripción</th>
                    <th className="text-right py-1.5 px-2 font-semibold whitespace-nowrap">Total</th>
                    <th className="text-right py-1.5 px-2 font-semibold whitespace-nowrap">Abono</th>
                    <th className="text-right py-1.5 px-2 font-semibold whitespace-nowrap">Deuda</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((d, idx) => (
                    <tr key={d.id} className="border-b border-border/40 last:border-0">
                      <td className="py-2 px-2 text-muted-foreground">{idx + 1}</td>
                      <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">
                        {fechaString(new Date(d.FechaEmision))}
                      </td>
                      <td className="py-2 px-2">
                        {d.Concepto ?? d.Descripcion ?? `Venta #${d.id}`}
                      </td>
                      <td className="py-2 px-2 text-right whitespace-nowrap tabular-nums">
                        {numToString(Number(d.Total))}
                      </td>
                      <td className="py-2 px-2 text-right whitespace-nowrap tabular-nums text-green-600">
                        {numToString(Number(d.TotalAbono))}
                      </td>
                      <td className="py-2 px-2 text-right whitespace-nowrap tabular-nums font-semibold text-red-600">
                        {numToString(Number(d.Saldo))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-orange-200">
                    <td colSpan={3} className="py-2 px-2 font-bold text-orange-800">
                      Subtotal
                    </td>
                    <td className="py-2 px-2 text-right font-bold whitespace-nowrap tabular-nums">
                      {numToString(items.reduce((s, d) => s + Number(d.Total), 0))}
                    </td>
                    <td className="py-2 px-2 text-right font-bold whitespace-nowrap tabular-nums text-green-600">
                      {numToString(items.reduce((s, d) => s + Number(d.TotalAbono), 0))}
                    </td>
                    <td className="py-2 px-2 text-right font-bold whitespace-nowrap tabular-nums text-red-600">
                      {numToString(items.reduce((s, d) => s + Number(d.Saldo), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })}

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground pb-4">
        Reporte generado el {new Date().toLocaleDateString("es-CL")}
      </p>
    </div>
  );
}
