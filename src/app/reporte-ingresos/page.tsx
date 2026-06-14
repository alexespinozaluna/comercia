"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Documento } from "@/types/database";
import { apiGet } from "@/lib/api-client";
import { useResource } from "@/hooks/use-resource";
import { obtenerRangosDeFechas } from "@/lib/date-utils";
import { agruparIngresosPorMetodo } from "@/lib/reportes";
import { useAppStore } from "@/stores/app-store";
import { DateFilterBar } from "@/components/ventas/date-filter-bar";
import { MetodoPagoCard } from "@/components/reportes/metodo-pago-card";
import { TotalesIngresosCards } from "@/components/reportes/totales-ingresos";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";

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

export default function ReporteIngresosPage() {
  const router = useRouter();
  const refreshCounter = useAppStore((s) => s.refreshCounter);
  const [filtro, setFiltro] = useState<RangoFiltro>(rangoInicial);

  const { data, loading } = useResource(
    () => apiGet<Documento[]>(`/api/ventas?fechaIni=${filtro.fi}&fechaFin=${filtro.ff}`),
    [filtro.fi, filtro.ff, refreshCounter],
  );
  const { grupos, totales } = useMemo(() => agruparIngresosPorMetodo(data ?? []), [data]);

  return (
    <div className="space-y-3 max-w-lg mx-auto">
      <PageHeader title="Reporte de ingresos" onBack={() => router.back()} />

      <DateFilterBar
        tipo={filtro.tipo}
        index={filtro.index}
        fechaInicio={filtro.fi}
        fechaFin={filtro.ff}
        onFilterChange={(tipo, index, fi, ff) => setFiltro({ tipo, index, fi, ff })}
      />

      {loading ? (
        <LoadingState variant="skeleton-detail" count={4} />
      ) : grupos.length === 0 ? (
        <EmptyState
          title="Sin movimientos"
          description="No hay ventas ni abonos en el rango seleccionado."
        />
      ) : (
        <>
          <TotalesIngresosCards totales={totales} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {grupos.map((g) => (
              <MetodoPagoCard key={g.metodo} grupo={g} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
