"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DeudaDetalle, Negocio } from "@/types/database";
import { apiGet } from "@/lib/api-client";
import { numToString, fechaString, parseDateOnly } from "@/lib/format";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { BotonCompartirDeuda } from "@/components/deuda/BotonCompartirDeuda";
import { BookOpenText, ChevronLeft, CreditCard } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface DeudaGrupo {
  Direccion: string;
  Items: DeudaDetalle[];
  SubTotal: number;
}

const SIN_DIRECCION = "Sin dirección";

function formatHora(fechaIso: string): string {
  return new Date(fechaIso).toLocaleTimeString("es-ES", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function DeudaDetallePage({ params }: { params: Promise<{ idCliente: string }> }) {
  const router = useRouter();
  const [idCliente, setIdCliente] = useState<number>(0);
  const [deudas, setDeudas] = useState<DeudaDetalle[]>([]);
  const [negocioNombre, setNegocioNombre] = useState("");
  const [loading, setLoading] = useState(true);

  // Carga: pide al backend solo las deudas de este cliente (filtrado en la BD).
  // Antes traíamos todas las deudas del tenant y filtrabamos en JavaScript.
  useEffect(() => {
    params.then(async (p) => {
      const cid = parseInt(p.idCliente);
      setIdCliente(cid);
      try {
        const [data, negocio] = await Promise.all([
          apiGet<DeudaDetalle[]>(`/api/deudas/detalle?idCliente=${cid}`),
          apiGet<Negocio | null>("/api/negocio").catch(() => null),
        ]);
        setDeudas(data);
        setNegocioNombre(negocio?.Nombre ?? "");
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    });
  }, [params]);

  const nomCliente = deudas[0]?.NomCliente ?? "Cliente";
  const totalSaldo = useMemo(() => deudas.reduce((sum, d) => sum + Number(d.Saldo), 0), [deudas]);
  const totalAbonado = useMemo(
    () => deudas.reduce((sum, d) => sum + Number(d.TotalAbono ?? 0), 0),
    [deudas]
  );

  const grupos = useMemo<DeudaGrupo[]>(() => {
    const sorted = [...deudas].sort((a, b) => (a.FechaEmision < b.FechaEmision ? 1 : -1));
    const map = new Map<string, DeudaGrupo>();
    for (const d of sorted) {
      const dir = d.DireccionEntrega?.trim() || SIN_DIRECCION;
      const saldoNumerico = Number(d.Saldo);
      const g = map.get(dir);
      if (g) {
        g.Items.push(d);
        g.SubTotal += saldoNumerico;
      } else {
        map.set(dir, { Direccion: dir, Items: [d], SubTotal: saldoNumerico });
      }
    }
    return Array.from(map.values());
  }, [deudas]);

  if (loading) return <LoadingState variant="skeleton-detail" count={5} />;

  return (
    <div className="space-y-2 pb-24">
      {/* Header simple */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => router.push("/deuda")}
          aria-label="Volver"
          className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 min-w-0 font-bold text-base text-foreground uppercase truncate">
          {nomCliente}
        </h1>
        {idCliente > 0 && (
          <BotonCompartirDeuda
            idCliente={idCliente}
            nombreCliente={nomCliente}
            nombreNegocio={negocioNombre}
            totalDeuda={totalSaldo}
            nroTelefono={deudas[0]?.NroTelefono}
          />
        )}
      </div>

      {deudas.length === 0 ? (
        <EmptyState
          icon={BookOpenText}
          title="Sin deudas"
          description="Este cliente no tiene deudas pendientes."
        />
      ) : (
        <>
          {/* Cards Deuda + Abono */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-3">
              <p className="text-xs text-destructive font-semibold">Deuda</p>
              <p className="font-bold text-2xl text-destructive tabular-nums truncate">
                {numToString(totalSaldo)}
              </p>
            </div>
            <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-3">
              <p className="text-xs text-success font-semibold">Abono</p>
              <p className="font-bold text-2xl text-success tabular-nums truncate">
                {numToString(totalAbonado)}
              </p>
            </div>
          </div>

          {/* Grupos por dirección */}
          <div className="space-y-3">
            {grupos.map((g) => (
              <div
                key={g.Direccion}
                className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 overflow-hidden"
              >
                {/* Group header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-sm font-semibold truncate flex-1">
                    {g.Direccion}
                  </span>
                  <span className="text-sm font-semibold tabular-nums shrink-0 ml-3">
                    {numToString(g.SubTotal)}
                  </span>
                </div>

                {/* Items */}
                <div className="divide-y divide-border">
                  {g.Items.map((d) => {
                    const hasAbonoParcial =
                      (d.TotalAbono ?? 0) > 0 && d.Saldo < d.Total;
                    const relTime = formatDistanceToNow(new Date(d.FechaCreacion), {
                      addSuffix: true,
                      locale: es,
                    });
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => router.push(`/venta-detalle/${d.id}`)}
                        className="w-full flex items-start justify-between gap-2 px-3 py-2.5 hover:bg-accent/30 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">
                            {d.Concepto ?? d.Descripcion ?? `Venta #${d.id}`}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">
                            {fechaString(parseDateOnly(d.FechaEmision))} | {formatHora(d.FechaCreacion)} | {relTime}
                          </div>
                          {d.NomUsuarioCreacion && (
                            <div className="text-xs text-muted-foreground truncate">
                              Creada por {d.NomUsuarioCreacion}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          <span className="text-sm font-semibold text-success tabular-nums">
                            {numToString(d.Saldo)}
                          </span>
                          {hasAbonoParcial && (
                            <span className="text-xs text-destructive line-through tabular-nums">
                              {numToString(d.Total)}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Botón Abonar fijo */}
          <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 md:left-[220px] z-40 px-4 py-3 bg-white dark:bg-card border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.07)]">
            <div className="max-w-lg mx-auto">
              <Button
                className="w-full h-12 text-base font-bold bg-brand hover:bg-brand-dark text-white rounded-md gap-2"
                onClick={() =>
                  router.push(`/venta-abono?id=${idCliente}&tipo=2&pagina=deuda`)
                }
              >
                <CreditCard className="h-5 w-5" />
                Abonar {numToString(totalSaldo)}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
