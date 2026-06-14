"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeudaResumen } from "@/types/database";
import { apiGet } from "@/lib/api-client";
import { useResource } from "@/hooks/use-resource";
import { numToString, fechaString, parseDateOnly } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { BookOpenText, ChevronRight } from "lucide-react";

export default function DeudaPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  // Carga inicial: el resumen agregado ya viene calculado desde Supabase
  // (función fn_deuda_resumen). Sin pasadas de JavaScript ni Map<>.
  const { data, loading } = useResource(() =>
    apiGet<DeudaResumen[]>("/api/deudas/resumen"),
  );
  const resumen = data ?? [];

  const filtered = search
    ? resumen.filter((r) => (r.NomCliente ?? "").toLowerCase().includes(search.toLowerCase()))
    : resumen;

  const totalPorCobrar = filtered.reduce((sum, r) => sum + Number(r.SumSaldo), 0);

  return (
    <div className="space-y-2">
      <PageHeader title="Deudas" />

      {/* Card resumen */}
      <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-4 flex items-center justify-between">
        {/* Izquierda — total monetario */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Total pendiente
          </p>
          <p className="text-[26px] font-extrabold text-destructive tabular-nums leading-tight">
            {numToString(totalPorCobrar)}
          </p>
        </div>

        {/* Derecha — clientes + total deudas */}
        <div className="text-right">
          <div className="flex items-baseline justify-end gap-1.5">
            <span className="text-[26px] font-extrabold text-foreground tabular-nums leading-tight">
              {resumen.length}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5 tabular-nums">
              ({resumen.reduce((s, r) => s + r.Cantidad, 0)})
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
            {resumen.length === 1 ? "Cliente" : "Clientes"}
          </p>
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
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/deuda-detalle/${r.IdCliente}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/deuda-detalle/${r.IdCliente}`);
                    }
                  }}
                  className="w-full text-left p-3 cursor-pointer"
                >
                  {/* Primera fila — nombre completo */}
                  <div className="flex items-start gap-2">
                    <span className="flex-1 text-sm font-bold text-foreground">
                      {nombre}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-0.5" />
                  </div>

                  {/* Segunda fila — info + saldo + abonar */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 min-w-0 text-xs text-muted-foreground">
                      {r.Cantidad} deuda{r.Cantidad !== 1 ? "s" : ""} ·{" "}
                      {fechaString(parseDateOnly(r.MaxFechaEmision))}
                    </div>
                    <div className="text-[16px] font-extrabold text-destructive leading-none tabular-nums shrink-0">
                      {numToString(Number(r.SumSaldo))}
                    </div>
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-brand hover:bg-brand-dark text-white px-2.5 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/venta-abono?id=${r.IdCliente}&tipo=2&pagina=deuda`);
                      }}
                    >
                      Abonar
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
