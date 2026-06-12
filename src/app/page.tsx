"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Documento } from "@/types/database";
import { apiGet } from "@/lib/api-client";
import { useAppStore } from "@/stores/app-store";
import { numToString } from "@/lib/format";
import { TipoDoc, esEgreso } from "@/lib/tipo-documento";
import { obtenerRangosDeFechas } from "@/lib/date-utils";
import { DateFilterBar } from "@/components/ventas/date-filter-bar";
import { BalanceCards } from "@/components/ventas/balance-cards";
import { VentaListItem } from "@/components/ventas/venta-list-item";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput } from "@/components/shared/search-input";
import { FilterSheet, EMPTY_FILTER, pasaFiltro, type VentaFilter } from "@/components/ventas/filter-sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { Receipt, TrendingDown, ChevronDown, Monitor, Smartphone } from "lucide-react";

/* ── HomePage ──────────────────────────────────────────────── */
export default function HomePage() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [ventas, setVentas] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<VentaFilter>(EMPTY_FILTER);

  const { filterTipo, filterIndex, filterFechaInicio, filterFechaFin, setFilter, refreshCounter } =
    useAppStore();

  // Restore filter from sessionStorage
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("HistoryState");
      if (saved) {
        const state = JSON.parse(saved);
        if (state.Tipo && state.FechaInicio && state.FechaFin) {
          setFilter(state.Tipo, state.Index ?? 0, state.FechaInicio, state.FechaFin);
        }
      }
    } catch {}
  }, [setFilter]);

  const loadVentas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Documento[]>(
        `/api/ventas?fechaIni=${filterFechaInicio}&fechaFin=${filterFechaFin}`
      );
      setVentas(data);
    } catch (err) {
      console.error("Error loading ventas:", err);
    } finally {
      setLoading(false);
    }
  }, [filterFechaInicio, filterFechaFin]);

  useEffect(() => {
    loadVentas();
  }, [loadVentas, refreshCounter]);

  const handleFilterChange = (
    tipo: string,
    index: number,
    fechaInicio: string,
    fechaFin: string
  ) => {
    setFilter(tipo, index, fechaInicio, fechaFin);
    sessionStorage.setItem(
      "HistoryState",
      JSON.stringify({ Tipo: tipo, FechaInicio: fechaInicio, FechaFin: fechaFin, Index: index })
    );
  };

  // Computed values — identical to original
  // tipo 6 = abono con saldo a favor: SÍ se ve en la lista, pero NO cuenta en
  // los totales (es transferencia interna; el dinero ya se contó al capturarlo).
  const ingresos = ventas.filter((v) => !esEgreso(v.IdTipoDocumento));
  const gastos = ventas.filter((v) => esEgreso(v.IdTipoDocumento));
   // Búsqueda sobre los movimientos del rango (no afecta totales del Balance)
  const term = search.toLowerCase();
  const filteredIngresos = search
    ? ingresos.filter(
        (v) =>
          v.Concepto?.toLowerCase().includes(term) ||
          v.Descripcion?.toLowerCase().includes(term) ||
          v.Cliente?.Nombre?.toLowerCase().includes(term)
      )
    : ingresos;
  const filteredGastos = search
    ? gastos.filter(
        (v) =>
          v.Concepto?.toLowerCase().includes(term) ||
          v.Descripcion?.toLowerCase().includes(term)
      )
    : gastos;

  // Filtros (Método pago / Usuario / Cliente): refinan SOLO la lista mostrada;
  // los totales del Balance se siguen calculando sobre filtered* (sin filtros).
  const displayIngresos = filteredIngresos.filter((v) => pasaFiltro(v, filtros));
  const displayGastos = filteredGastos.filter((v) => pasaFiltro(v, filtros));

  // Efectivo = venta pagada (tipo 1) + captura de saldo a favor (tipo 4).
  // NO incluye abonos (tipo 2, tienen su propia card) ni el consumo de saldo a
  // favor (tipo 6, transferencia interna ya contada al capturar).
  const totalEfectivo = filteredIngresos
    .filter((v) => !v.bCredito && (v.IdTipoDocumento === TipoDoc.VENTA || v.IdTipoDocumento === TipoDoc.SALDO_FAVOR))
    .reduce((sum, v) => sum + v.Total, 0);
  // Abono = documentos de abono (tipo 2). Excluye por construcción el tipo 6.
  const totalAbono = filteredIngresos
    .filter((v) => v.IdTipoDocumento === TipoDoc.ABONO)
    .reduce((sum, v) => sum + v.Total, 0);
  const totalGastos = filteredGastos.reduce((sum, v) => sum + v.Total, 0);
  const balance = totalEfectivo + totalAbono - totalGastos;
  const totalCredito = filteredIngresos.filter((v) => v.bCredito).reduce((sum, v) => sum + v.Saldo, 0);
  const ventasOnly = filteredIngresos.filter((v) => v.IdTipoDocumento === TipoDoc.VENTA);
  const ventasCount = ventasOnly.length;
  const ventasTotal = ventasOnly.reduce((sum, v) => sum + v.Total, 0); 

  // Header date
  const hoy = new Date();
  const fechaLarga = hoy.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const fechaHeader = fechaLarga.charAt(0).toUpperCase() + fechaLarga.slice(1);

  // Period label
  const rangos = obtenerRangosDeFechas(filterTipo);
  const periodoLabel = rangos[filterIndex]?.FechaTexto ?? filterFechaInicio;

  return (
    <div className="space-y-2">
      {/* Topbar */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold leading-tight">{fechaHeader}</h1>
          <p className="text-xs text-muted-foreground capitalize mt-0.5">{periodoLabel}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {/* Móvil: directo al wizard de 3 pasos. Desktop: elegir entre los
              dos modos de venta. */}
          {isDesktop ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-8 text-xs px-3 rounded-md bg-brand hover:bg-brand-dark text-white shadow-sm font-medium transition-colors cursor-pointer outline-none">
                <Receipt className="h-4 w-4" />
                Nueva venta
                <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuItem onClick={() => router.push("/venta/nueva")} className="gap-2">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  Venta clásica
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/venta/nueva-movil")} className="gap-2">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  Venta móvil (3 pasos)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              className="h-8 text-xs px-3 bg-brand hover:bg-brand-dark text-white shadow-sm gap-1.5"
              onClick={() => router.push("/venta/nueva-movil")}
            >
              <Receipt className="h-4 w-4" />
              <span className="hidden sm:inline">Nueva venta</span>
            </Button>
          )}
          <Button
            variant="outline"
            className="h-8 text-xs px-3 gap-1.5 text-destructive border-destructive/20 hover:bg-destructive/5 hover:text-destructive"
            onClick={() => router.push("/venta-gasto?id=0")}
          >
            <TrendingDown className="h-4 w-4" />
            <span className="hidden sm:inline">Gasto</span>
          </Button>
        </div>
      </div>

      {/* Date filter */}
      <DateFilterBar
        tipo={filterTipo}
        index={filterIndex}
        fechaInicio={filterFechaInicio}
        fechaFin={filterFechaFin}
        onFilterChange={handleFilterChange}
      />

      {/* Balance cards */}
      <BalanceCards
        balance={balance}
        efectivo={totalEfectivo}
        abono={totalAbono}
        gastos={totalGastos}
        cobrosPendientes={totalCredito}
        ventasCount={ventasCount}
        ventasTotal={ventasTotal}
      />

      {/* Búsqueda + filtros — refinan los items de cada tab, sin afectar los totales del Balance */}
      <div className="flex items-center gap-2">
        <SearchInput
          className="flex-1"
          placeholder="Buscar ventas, clientes o conceptos..."
          value={search}
          onChange={setSearch}
          debounceMs={300}
        />
        <FilterSheet ventas={ventas} value={filtros} onChange={setFiltros} />
      </div>

      {/* Tabs: Ingresos / Gastos */}
      {loading && ventas.length === 0 ? (
        <LoadingState variant="skeleton-list" count={4} />
      ) : (
        <Tabs defaultValue="ingreso">
          <TabsList className="w-full h-9 bg-muted/50 rounded-lg p-0.5">
            <TabsTrigger
              value="ingreso"
              className="flex-1 text-xs font-medium gap-1.5 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Receipt className="h-3.5 w-3.5" />
              Ingresos
              <span className="text-muted-foreground font-normal">
                ({numToString(totalEfectivo + totalAbono)})
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="gasto"
              className="flex-1 text-xs font-medium gap-1.5 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <TrendingDown className="h-3.5 w-3.5" />
              Gastos
              <span className="text-muted-foreground font-normal">
                ({numToString(totalGastos)})
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ingreso" className="mt-3">
            {displayIngresos.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title={search ? "Sin resultados" : "Sin ingresos"}
                description={
                  search
                    ? `No se encontraron ingresos para "${search}".`
                    : "No hay ingresos en este periodo."
                }
              />
            ) : (
              <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 divide-y divide-border overflow-hidden">
                {displayIngresos.map((v) => (
                  <div key={v.id} className="px-3">
                    <VentaListItem venta={v} />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="gasto" className="mt-3">
            {displayGastos.length === 0 ? (
              <EmptyState
                icon={TrendingDown}
                title={search ? "Sin resultados" : "Sin gastos"}
                description={
                  search
                    ? `No se encontraron gastos para "${search}".`
                    : "No hay gastos en este periodo."
                }
              />
            ) : (
              <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 divide-y divide-border overflow-hidden">
                {displayGastos.map((v) => (
                  <div key={v.id} className="px-3">
                    <VentaListItem venta={v} />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
