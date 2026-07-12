"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Documento } from "@/types/database";
import { apiGet } from "@/lib/api-client";
import { useResource } from "@/hooks/use-resource";
import { obtenerRangosDeFechas } from "@/lib/date-utils";
import { agruparPorTipoDocumento, agruparIngresosPorUsuario } from "@/lib/reportes";
import { useAppStore } from "@/stores/app-store";
import { DateFilterBar } from "@/components/ventas/date-filter-bar";
import { CollapsibleReportCard } from "@/components/reportes/collapsible-report-card";
import { TotalesIngresosCards } from "@/components/reportes/totales-ingresos";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

interface RangoFiltro {
  tipo: string;
  index: number;
  fi: string;
  ff: string;
}

/** Rango inicial = el día actual (criterio "Dia", índice activo). */
function rangoInicial(): RangoFiltro {
  const rangos = obtenerRangosDeFechas("Dia");
  const index = Math.max(0, rangos.findIndex((r) => r.bActual));
  const r = rangos[index];
  return {
    tipo: "Dia",
    index,
    fi: format(r.FechaInicio, "yyyy-MM-dd"),
    ff: format(r.FechaFin, "yyyy-MM-dd"),
  };
}

type Vista = "tipo" | "usuario";

export default function ReporteIngresosPage() {
  const router = useRouter();
  const refreshCounter = useAppStore((s) => s.refreshCounter);
  const [filtro, setFiltro] = useState<RangoFiltro>(rangoInicial);
  const [vista, setVista] = useState<Vista>("tipo");

  const { data, loading } = useResource(
    () => apiGet<Documento[]>(`/api/ventas?fechaIni=${filtro.fi}&fechaFin=${filtro.ff}`),
    [filtro.fi, filtro.ff, refreshCounter],
  );
  // Misma carga de datos; solo cambia la agrupación según la vista elegida.
  const porTipo = useMemo(() => agruparPorTipoDocumento(data ?? []), [data]);
  const porUsuario = useMemo(() => agruparIngresosPorUsuario(data ?? []), [data]);

  const totales = vista === "tipo" ? porTipo.totales : porUsuario.totales;
  const vacio = vista === "tipo" ? porTipo.grupos.length === 0 : porUsuario.grupos.length === 0;

  return (
    <div className="space-y-3 mx-auto w-full max-w-lg lg:max-w-5xl">
      <PageHeader title="Reporte de ingresos" onBack={() => router.back()} />

      <DateFilterBar
        tipo={filtro.tipo}
        index={filtro.index}
        fechaInicio={filtro.fi}
        fechaFin={filtro.ff}
        onFilterChange={(tipo, index, fi, ff) => setFiltro({ tipo, index, fi, ff })}
      />

      {/* Toggle de vista: por método de pago / por usuario */}
      <div className="flex gap-1 rounded-lg bg-muted/60 p-1 sm:max-w-xs">
        {([
          ["tipo", "Por tipo"],
          ["usuario", "Por usuario"],
        ] as const).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setVista(v)}
            aria-pressed={vista === v}
            className={cn(
              "flex-1 h-9 rounded-md text-sm font-medium transition-colors",
              vista === v
                ? "bg-white dark:bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState variant="skeleton-detail" count={4} />
      ) : vacio ? (
        <EmptyState
          title="Sin movimientos"
          description="No hay ventas ni abonos en el rango seleccionado."
        />
      ) : (
        <>
          {/* Gastos se muestra siempre (ambas vistas). */}
          <TotalesIngresosCards totales={totales} showGastos />
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {vista === "tipo"
              ? porTipo.grupos.map((g) => (
                  <CollapsibleReportCard
                    key={g.idTipo}
                    title={g.tipo}
                    count={g.count}
                    amount={g.total}
                    nodes={g.metodos.map((m) => ({ label: m.metodo, count: m.count, total: m.total }))}
                  />
                ))
              : porUsuario.grupos.map((g) => (
                  <CollapsibleReportCard
                    key={g.idUsuario ?? "sin-usuario"}
                    title={g.usuario}
                    count={g.count}
                    amount={g.balance}
                    nodes={g.tipos.map((t) => ({
                      label: t.tipo,
                      count: t.count,
                      total: t.total,
                      children: t.metodos.map((m) => ({ label: m.metodo, count: m.count, total: m.total })),
                    }))}
                  />
                ))}
          </div>
        </>
      )}
    </div>
  );
}
