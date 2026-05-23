"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Documento, Producto } from "@/types/database";
import { apiGet } from "@/lib/api-client";
import { useAppStore } from "@/stores/app-store";
import { QuickMetricCards } from "@/components/ventas/quick-metric-cards";
import { DateFilterBar } from "@/components/ventas/date-filter-bar";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { numToString, fechaString, sbsLeft } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Plus, ShoppingBag } from "lucide-react";
import { LossSection } from "@/components/ventas/loss-section";

export default function VentasAllPage() {
  const [ventas, setVentas] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Metrics state
  const [ventasHoy, setVentasHoy] = useState(0);
  const [ventasHoyCount, setVentasHoyCount] = useState(0);
  const [porCobrar, setPorCobrar] = useState(0);
  const [stockCritico, setStockCritico] = useState(0);
  const [metricsLoading, setMetricsLoading] = useState(true);

  const { filterTipo, filterIndex, filterFechaInicio, filterFechaFin, setFilter, refreshCounter } = useAppStore();

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

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const [ventasHoyData, deudasData, productosData] = await Promise.all([
        apiGet<Documento[]>(`/api/ventas?fechaIni=${today}&fechaFin=${today}`),
        apiGet<Documento[]>("/api/deudas"),
        apiGet<Producto[]>("/api/productos"),
      ]);

      const ventasOnlyHoy = ventasHoyData.filter((v) => v.IdTipoDocumento === 1);
      setVentasHoy(ventasOnlyHoy.reduce((sum, v) => sum + v.Total, 0));
      setVentasHoyCount(ventasOnlyHoy.length);
      setPorCobrar(deudasData.reduce((sum, d) => sum + d.Saldo, 0));
      setStockCritico(productosData.filter((p) => p.Cantidad !== null && p.Cantidad <= 5).length);
    } catch (err) {
      console.error("Error loading metrics:", err);
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVentas();
  }, [loadVentas, refreshCounter]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics, refreshCounter]);

  const handleFilterChange = (tipo: string, index: number, fechaInicio: string, fechaFin: string) => {
    setFilter(tipo, index, fechaInicio, fechaFin);
  };

  const filtered = search
    ? ventas.filter((v) => {
        const term = search.toLowerCase();
        return (
          (v.Concepto?.toLowerCase().includes(term)) ||
          (v.Descripcion?.toLowerCase().includes(term)) ||
          (v.Cliente?.Nombre?.toLowerCase().includes(term))
        );
      })
    : ventas;

  return (
    <div className="space-y-4">
      {/* Quick metrics */}
      <QuickMetricCards
        ventasHoy={ventasHoy}
        ventasHoyCount={ventasHoyCount}
        porCobrar={porCobrar}
        stockCritico={stockCritico}
        loading={metricsLoading}
      />

      {/* Perdidas y alertas de vencimiento */}
      <LossSection fechaInicio={filterFechaInicio} fechaFin={filterFechaFin} />

      <DateFilterBar
        tipo={filterTipo}
        index={filterIndex}
        fechaInicio={filterFechaInicio}
        fechaFin={filterFechaFin}
        onFilterChange={handleFilterChange}
      />

      <SearchInput
        placeholder="Buscar ventas, clientes o conceptos..."
        value={search}
        onChange={setSearch}
        debounceMs={300}
      />

      {loading ? (
        <LoadingState variant="skeleton-list" count={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Sin resultados"
          description="No se encontraron ventas para los filtros aplicados."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {filtered.map((v) => {
            const isGasto = v.IdTipoDocumento === 3;
            const isCredito = v.bCredito;
            const nombre = v.Cliente?.Nombre ?? v.Concepto ?? v.Descripcion ?? "";
            const concepto = v.Concepto ?? v.Descripcion ?? "";

            return (
              <Link
                key={v.id}
                href={`/venta-detalle/${v.id}`}
                className={cn(
                  "group flex items-start gap-3 p-3 rounded-xl transition-all",
                  "border ring-1 hover:shadow-md",
                  isGasto
                    ? "ring-destructive/20 hover:ring-destructive/40 bg-card"
                    : "ring-border/60 hover:ring-primary/30 bg-card"
                )}
              >
                <div className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                  isGasto ? "bg-destructive/10" : "bg-success/10"
                )}>
                  {isGasto ? (
                    <ArrowDownRight className="h-4 w-4 text-destructive" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-success" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{sbsLeft(nombre, 24)}</span>
                    {isCredito && <StatusBadge variant="info">Credito</StatusBadge>}
                    {!isCredito && !isGasto && <StatusBadge variant="success">Pagado</StatusBadge>}
                  </div>
                  {concepto && nombre !== concepto && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{sbsLeft(concepto, 35)}</div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">{fechaString(new Date(v.FechaEmision))}</div>
                </div>
                <div className="shrink-0 text-right">
                  <span className={cn(
                    "text-sm font-semibold",
                    isGasto ? "text-destructive" : "text-success"
                  )}>
                    {numToString(isGasto ? -Math.abs(v.Total) : v.Total)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* FAB - Nueva Venta (thumb-optimized) */}
      <Link
        href="/venta/nueva"
        className={cn(
          "fixed bottom-20 md:bottom-6 right-4 md:right-6 z-30",
          "flex items-center gap-2",
          "h-14 px-5 rounded-full",
          "bg-primary text-primary-foreground",
          "shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30",
          "transition-all active:scale-95"
        )}
      >
        <Plus className="h-5 w-5" />
        <span className="text-sm font-semibold">Nueva Venta</span>
      </Link>
    </div>
  );
}