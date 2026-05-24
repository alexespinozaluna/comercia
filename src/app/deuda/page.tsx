"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DeudaResumen } from "@/types/database";
import { apiGet } from "@/lib/api-client";
import { numToString, extraerIniciales, fechaString } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { BookOpenText, Users, Wallet, ChevronRight } from "lucide-react";

export default function DeudaPage() {
  const router = useRouter();
  const [resumen, setResumen] = useState<DeudaResumen[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Carga inicial: el resumen agregado ya viene calculado desde Supabase
  // (función fn_deuda_resumen). Sin pasadas de JavaScript ni Map<>.
  useEffect(() => {
    async function load() {
      try {
        const data = await apiGet<DeudaResumen[]>("/api/deudas/resumen");
        setResumen(
  data.sort((a, b) => {
    const dateA = a.MaxFechaEmision ? new Date(a.MaxFechaEmision).getTime() : 0;
    const dateB = b.MaxFechaEmision ? new Date(b.MaxFechaEmision).getTime() : 0;
    return dateB - dateA; // más reciente primero
  })
);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = search
    ? resumen.filter((r) => (r.NomCliente ?? "").toLowerCase().includes(search.toLowerCase()))
    : resumen;

  const totalClientes = filtered.length;
  const totalPorCobrar = filtered.reduce((sum, r) => sum + Number(r.SumSaldo), 0);

  return (
    <div className="space-y-2">
      <PageHeader title="Deudas" />

      {/* Cards de resumen */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-3 flex items-center gap-2">
          <div className="h-10 w-10 rounded-md bg-info/10 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5 text-info" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Clientes con deuda
            </p>
            <p className="text-[20px] font-extrabold text-foreground leading-tight tabular-nums">
              {totalClientes}
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-3 flex items-center gap-2">
          <div className="h-10 w-10 rounded-md bg-destructive/10 flex items-center justify-center shrink-0">
            <Wallet className="h-5 w-5 text-destructive" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Total pendiente
            </p>
            <p className="text-[20px] font-extrabold text-destructive leading-tight tabular-nums truncate">
              {numToString(totalPorCobrar)}
            </p>
          </div>
        </div>
      </div>

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
        <div className="space-y-2">
          {filtered.map((r) => {
            const nombre = r.NomCliente ?? "Sin nombre";
            return (
              <div
                key={r.IdCliente}
                className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 overflow-hidden hover:ring-brand/30 transition-all"
              >
                <div className="flex items-center gap-2 p-3">
                  <button
                    type="button"
                    onClick={() => router.push(`/deuda-detalle/${r.IdCliente}`)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    <div className="h-10 w-10 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-red-600 dark:text-red-400">
                        {extraerIniciales(nombre)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate text-foreground hover:text-brand transition-colors">
                        {nombre}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.Cantidad} deuda{r.Cantidad !== 1 ? "s" : ""}
                      </div>
                       <div className="text-xs text-muted-foreground">
                        {fechaString(new Date(r.MaxFechaEmision))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[16px] font-extrabold text-destructive leading-none tabular-nums">
                        {numToString(Number(r.SumSaldo))}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                  </button>
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-brand hover:bg-brand-dark text-white px-2.5 shrink-0"
                    onClick={() =>
                      router.push(`/venta-abono?id=${r.IdCliente}&tipo=2&pagina=deuda`)
                    }
                  >
                    Abonar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
