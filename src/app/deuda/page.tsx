"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Documento } from "@/types/database";
import { apiGet } from "@/lib/api-client";
import { numToString, extraerIniciales, fechaString } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { BookOpenText, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResumenAbono {
  IdCliente: number;
  NomCliente: string;
  Cantidad: number;
  SumTotal: number;
  FechaUltima: string;
}

export default function DeudaPage() {
  const router = useRouter();
  const [deudas, setDeudas] = useState<Documento[]>([]);
  const [resumen, setResumen] = useState<ResumenAbono[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiGet<Documento[]>("/api/deudas");
        setDeudas(data);
        const grouped = new Map<number, ResumenAbono>();
        for (const d of data) {
          if (d.IdCliente == null) continue;
          const existing = grouped.get(d.IdCliente);
          if (existing) {
            existing.Cantidad++;
            existing.SumTotal += d.Saldo;
            if (d.FechaEmision > existing.FechaUltima) existing.FechaUltima = d.FechaEmision;
          } else {
            grouped.set(d.IdCliente, {
              IdCliente: d.IdCliente,
              NomCliente: d.Cliente?.Nombre ?? "Sin nombre",
              Cantidad: 1,
              SumTotal: d.Saldo,
              FechaUltima: d.FechaEmision,
            });
          }
        }
        const list = Array.from(grouped.values());
        setResumen(list);
        // Expand all by default
        setExpanded(new Set(list.map((r) => r.IdCliente)));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = search
    ? resumen.filter((r) => r.NomCliente.toLowerCase().includes(search.toLowerCase()))
    : resumen;

  const totalPorCobrar = resumen.reduce((sum, r) => sum + r.SumTotal, 0);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Deudas"
        actions={
          totalPorCobrar > 0 ? (
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total pendiente</p>
              <p className="text-sm font-extrabold text-destructive">{numToString(totalPorCobrar)}</p>
            </div>
          ) : undefined
        }
      />

      <SearchInput
        placeholder="Buscar deudor..."
        value={search}
        onChange={setSearch}
        debounceMs={300}
      />

      {loading ? (
        <LoadingState variant="skeleton-list" count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpenText}
          title="¡Todo al día!"
          description="No hay deudas pendientes."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const clientDeudas = deudas.filter((d) => d.IdCliente === r.IdCliente);
            const isOpen = expanded.has(r.IdCliente);

            return (
              <div
                key={r.IdCliente}
                className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 overflow-hidden"
              >
                {/* Client header */}
                <div className="flex items-center gap-3 p-3">
                  <div className="h-10 w-10 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-red-600 dark:text-red-400">
                      {extraerIniciales(r.NomCliente)}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{r.NomCliente}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.Cantidad} deuda{r.Cantidad !== 1 ? "s" : ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="text-[18px] font-extrabold text-destructive leading-none">
                        {numToString(r.SumTotal)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-brand hover:bg-brand-dark text-white px-2.5"
                      onClick={() =>
                        router.push(`/venta-abono?id=${r.IdCliente}&tipo=2&pagina=deuda`)
                      }
                    >
                      Abonar
                    </Button>
                    <button
                      type="button"
                      onClick={() => toggleExpand(r.IdCliente)}
                      className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent transition-colors text-muted-foreground"
                    >
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Ventas list — collapsible */}
                {isOpen && (
                  <div className="border-t border-border divide-y divide-border">
                    {clientDeudas.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => router.push(`/venta-detalle/${d.id}`)}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-accent/40 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-7 w-7 rounded-md bg-destructive/10 flex items-center justify-center shrink-0">
                            <BookOpenText className="h-3.5 w-3.5 text-destructive" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold truncate">
                              {d.Concepto ?? d.Descripcion ?? `Venta #${d.id}`}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {fechaString(new Date(d.FechaEmision))}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <div className="text-sm font-bold text-destructive">
                            {numToString(d.Saldo)}
                          </div>
                          {d.Total > d.Saldo && (
                            <div className="text-[11px] text-muted-foreground line-through">
                              {numToString(d.Total)}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
