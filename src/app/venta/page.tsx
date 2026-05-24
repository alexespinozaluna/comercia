"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { numToString } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Plus, ShoppingBag } from "lucide-react";
import { LossSection } from "@/components/ventas/loss-section";
import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

// Mapeo IdTipoDocumento → texto legible
const LABEL_TIPO_DOCUMENTO: Record<number, string> = {
  1: "Venta",
  2: "Abono",
  3: "Gasto",
};

const TIPO_GASTO = 3;
const TIPO_VENTA = 1;
const TIPO_ABONO = 2;

/** Etiqueta del grupo: "Hoy" / "Ayer" / "23 may". */
function etiquetaGrupoFecha(fechaIso: string): string {
  const fecha = new Date(fechaIso);
  if (isToday(fecha)) return "Hoy";
  if (isYesterday(fecha)) return "Ayer";
  return format(fecha, "d 'de' MMM", { locale: es });
}

/** Hora corta "HH:mm" tomada de FechaCreacion. */
function horaCorta(fechaIso: string): string {
  return format(new Date(fechaIso), "HH:mm");
}

// ────────────────────────────────────────────────────────────────────
// Página
// ────────────────────────────────────────────────────────────────────

export default function VentasAllPage() {
  const [ventas, setVentas] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Metricas globales (no dependen del rango — son de hoy / general)
  const [ventasHoy, setVentasHoy] = useState(0);
  const [ventasHoyCount, setVentasHoyCount] = useState(0);
  const [porCobrar, setPorCobrar] = useState(0);
  const [stockCritico, setStockCritico] = useState(0);
  const [metricsLoading, setMetricsLoading] = useState(true);

  const { filterTipo, filterIndex, filterFechaInicio, filterFechaFin, setFilter, refreshCounter } =
    useAppStore();

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

      const ventasOnlyHoy = ventasHoyData.filter((v) => v.IdTipoDocumento === TIPO_VENTA);
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

  // Filtro de busqueda sobre las ventas del rango
  const filtered = useMemo(() => {
    if (!search) return ventas;
    const term = search.toLowerCase();
    return ventas.filter((v) =>
      (v.Concepto?.toLowerCase().includes(term)) ||
      (v.Descripcion?.toLowerCase().includes(term)) ||
      (v.Cliente?.Nombre?.toLowerCase().includes(term))
    );
  }, [ventas, search]);

  // ── Balance del rango (se calcula sobre todas las ventas del rango,
  //    no sobre el filtro de busqueda — es la salud financiera del período) ──
  const balance = useMemo(() => {
    let ingresos = 0;
    let egresos = 0;
    for (const v of ventas) {
      if (v.IdTipoDocumento === TIPO_GASTO) {
        egresos += v.Total;
      } else if (v.IdTipoDocumento === TIPO_VENTA || v.IdTipoDocumento === TIPO_ABONO) {
        ingresos += v.Total;
      }
    }
    return { ingresos, egresos, neto: ingresos - egresos };
  }, [ventas]);

  // ── Agrupacion por fecha (FechaEmision yyyy-MM-dd) ──
  // El backend ya devuelve ordenado por FechaEmision DESC, así que los grupos
  // mantienen el orden de inserción del Map.
  const grupos = useMemo(() => {
    const map = new Map<string, { label: string; items: Documento[] }>();
    for (const v of filtered) {
      const dateKey = v.FechaEmision.slice(0, 10);
      const existing = map.get(dateKey);
      if (existing) {
        existing.items.push(v);
      } else {
        map.set(dateKey, { label: etiquetaGrupoFecha(v.FechaEmision), items: [v] });
      }
    }
    return Array.from(map.entries()).map(([key, value]) => ({ key, ...value }));
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Métricas globales (hoy / por cobrar / stock) */}
      <QuickMetricCards
        ventasHoy={ventasHoy}
        ventasHoyCount={ventasHoyCount}
        porCobrar={porCobrar}
        stockCritico={stockCritico}
        loading={metricsLoading}
      />

      {/* Card de balance del rango seleccionado */}
      <div className="bg-white dark:bg-card rounded-xl ring-1 ring-border/50 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Balance del período
            </p>
            <p
              className={cn(
                "text-[28px] font-extrabold tabular-nums leading-tight",
                balance.neto >= 0 ? "text-success" : "text-destructive"
              )}
            >
              {numToString(balance.neto)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Ingresos
            </p>
            <p className="text-sm font-bold text-success tabular-nums">
              {numToString(balance.ingresos)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Egresos
            </p>
            <p className="text-sm font-bold text-destructive tabular-nums">
              {numToString(balance.egresos)}
            </p>
          </div>
        </div>
      </div>

      {/* Pérdidas / vencimientos */}
      <LossSection fechaInicio={filterFechaInicio} fechaFin={filterFechaFin} />

      {/* Filtros */}
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

      {/* Lista vertical estilo "extracto bancario" */}
      {loading ? (
        <LoadingState variant="skeleton-list" count={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Sin resultados"
          description="No se encontraron movimientos para los filtros aplicados."
        />
      ) : (
        <div className="bg-white dark:bg-card rounded-xl ring-1 ring-border/50 overflow-hidden">
          {grupos.map((grupo) => (
            <div key={grupo.key}>
              {/* Encabezado de fecha */}
              <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/40">
                {grupo.label}
              </div>

              {/* Items del grupo */}
              {grupo.items.map((v) => {
                const esGasto = v.IdTipoDocumento === TIPO_GASTO;
                const esCredito = v.bCredito && !esGasto;
                const tipoLabel = LABEL_TIPO_DOCUMENTO[v.IdTipoDocumento] ?? "Movimiento";
                const nombre = v.Cliente?.Nombre ?? v.Concepto ?? v.Descripcion ?? "Sin descripción";
                const montoAMostrar = esGasto ? -Math.abs(v.Total) : v.Total;
                const colorMonto = esGasto ? "text-destructive" : "text-success";

                return (
                  <Link
                    key={v.id}
                    href={`/venta-detalle/${v.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors border-b border-border last:border-0"
                  >
                    {/* Ícono circular: arriba=ingreso, abajo=gasto */}
                    <div
                      className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                        esGasto ? "bg-destructive/10" : "bg-success/10"
                      )}
                    >
                      {esGasto ? (
                        <ArrowDownRight className="h-4 w-4 text-destructive" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-success" />
                      )}
                    </div>

                    {/* Centro: nombre, tipo+badge, hora */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{nombre}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-muted-foreground">{tipoLabel}</span>
                        {esCredito && <StatusBadge variant="info">Crédito</StatusBadge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {horaCorta(v.FechaCreacion)}
                      </div>
                    </div>

                    {/* Monto a la derecha */}
                    <div
                      className={cn(
                        "shrink-0 text-base font-bold tabular-nums",
                        colorMonto
                      )}
                    >
                      {numToString(montoAMostrar)}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
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
