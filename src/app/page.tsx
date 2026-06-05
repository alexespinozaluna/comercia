"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Documento } from "@/types/database";
import type { Caja } from "@/types/database";
import { apiGet } from "@/lib/api-client";
import { useAppStore } from "@/stores/app-store";
import { numToString, extraerIniciales } from "@/lib/format";
import { obtenerRangosDeFechas } from "@/lib/date-utils";
import { DateFilterBar } from "@/components/ventas/date-filter-bar";
import { BalanceCards } from "@/components/ventas/balance-cards";
import { VentaListItem } from "@/components/ventas/venta-list-item";
import { LossSection } from "@/components/ventas/loss-section";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput } from "@/components/shared/search-input";
import { FilterSheet, EMPTY_FILTER, pasaFiltro, type VentaFilter } from "@/components/ventas/filter-sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Receipt,
  TrendingDown,
  CreditCard,
  BookOpenText,
  Store,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Caja banner ───────────────────────────────────────────── */
function CajaBanner() {
  const [caja, setCaja] = useState<Caja | null | undefined>(undefined);
  const authUser = useAppStore((s) => s.authUser);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/caja")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCaja(d ?? null))
      .catch(() => setCaja(null));
  }, []);

  if (caja === undefined) {
    return <div className="h-14 rounded-lg animate-pulse bg-muted" />;
  }

  if (caja) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-brand-surface border border-brand/20 px-4 py-3">
        <div className="h-9 w-9 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
          <Store className="h-4 w-4 text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-brand-dark leading-tight">Caja abierta</div>
          {authUser && (
            <div className="text-[11px] text-brand/70">Cajero: {authUser.nombre}</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-base font-extrabold text-brand-dark">{numToString(caja.MontoInicial)}</span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-brand/30 text-brand-dark hover:bg-brand/10"
            onClick={() => router.push("/caja")}
          >
            Cerrar caja
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/50 border border-border px-4 py-3">
      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
        <Store className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-muted-foreground">Sin caja abierta</div>
        <div className="text-[11px] text-muted-foreground/70">Abre la caja para registrar ventas</div>
      </div>
      <Button
        size="sm"
        className="h-7 text-xs bg-brand hover:bg-brand-dark text-white shrink-0"
        onClick={() => router.push("/caja")}
      >
        Abrir caja
      </Button>
    </div>
  );
}

/* ── Acciones rápidas (mobile only) ──────────────────────────── */
function AccionesRapidas() {
  const router = useRouter();
  const acciones = [
    { label: "Nueva venta", icon: Receipt, href: "/venta/nueva", variant: "brand" as const },
    { label: "Registrar abono", icon: CreditCard, href: "/venta-abono", variant: "secondary" as const },
    { label: "Registrar gasto", icon: TrendingDown, href: "/venta-gasto?id=0", variant: "destructive-outline" as const },
    { label: "Ver deudas", icon: BookOpenText, href: "/deuda", variant: "secondary" as const },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 md:hidden">
      {acciones.map(({ label, icon: Icon, href, variant }) => (
        <button
          key={href}
          onClick={() => router.push(href)}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
            variant === "brand" && "bg-brand text-white hover:bg-brand-dark",
            variant === "secondary" && "bg-white dark:bg-card text-foreground ring-1 ring-border hover:bg-accent",
            variant === "destructive-outline" && "bg-white dark:bg-card text-destructive ring-1 ring-destructive/20 hover:bg-destructive/5"
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="text-left leading-tight">{label}</span>
        </button>
      ))}
    </div>
  );
}

/* ── HomePage ──────────────────────────────────────────────── */
export default function HomePage() {
  const router = useRouter();
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
  const ingresos = ventas.filter((v) => v.IdTipoDocumento !== 3);
  const gastos = ventas.filter((v) => v.IdTipoDocumento === 3);
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

  const totalEfectivo = filteredIngresos.filter((v) => !v.bCredito).reduce((sum, v) => sum + v.Total, 0);
  const totalAbono = filteredIngresos.filter((v) => v.bCredito).reduce((sum, v) => sum + v.TotalAbono, 0);
  const totalGastos = filteredGastos.reduce((sum, v) => sum + v.Total, 0);
  const balance = totalEfectivo + totalAbono - totalGastos;
  const totalCredito = filteredIngresos.filter((v) => v.bCredito).reduce((sum, v) => sum + v.Saldo, 0);
  const ventasOnly = filteredIngresos.filter((v) => v.IdTipoDocumento === 1);
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
          <Button
            className="h-8 text-xs px-3 bg-brand hover:bg-brand-dark text-white shadow-sm gap-1.5"
            onClick={() => router.push("/venta/nueva")}
          >
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Nueva venta</span>
          </Button>
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
