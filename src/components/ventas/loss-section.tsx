"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet } from "@/lib/api-client";
import { numToString } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, TrendingDown, Clock, Package, ChevronDown, ChevronUp } from "lucide-react";

interface LossByMotivo {
  count: number;
  total: number;
}

interface LossItem {
  id: number;
  motivo: string;
  fecha: string;
  producto: string;
  cantidad: number;
  precioUnitario: number;
  total: number;
}

interface ExpiringProduct {
  id: number;
  Nombre: string;
  PrecioVenta: number;
  PrecioCosto: number | null;
  Cantidad: number | null;
  FechaVencimiento: string;
}

interface PerdidasData {
  porMotivo: Record<string, LossByMotivo>;
  totalPerdida: number;
  items: LossItem[];
  proxVencer: ExpiringProduct[];
  vencidos: ExpiringProduct[];
}

const MOTIVO_STYLES: Record<string, { bg: string; text: string; ring: string; icon: React.ReactNode }> = {
  Merma: {
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/25",
    icon: <TrendingDown className="h-4 w-4" />,
  },
  Vencimiento: {
    bg: "bg-red-500/10",
    text: "text-red-600 dark:text-red-400",
    ring: "ring-red-500/25",
    icon: <Clock className="h-4 w-4" />,
  },
  "Daño": {
    bg: "bg-orange-500/10",
    text: "text-orange-600 dark:text-orange-400",
    ring: "ring-orange-500/25",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  Robo: {
    bg: "bg-purple-500/10",
    text: "text-purple-600 dark:text-purple-400",
    ring: "ring-purple-500/25",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
};

const DEFAULT_STYLE = {
  bg: "bg-muted",
  text: "text-muted-foreground",
  ring: "ring-border/60",
  icon: <AlertTriangle className="h-4 w-4" />,
};

function getMotivoStyle(motivo: string) {
  return MOTIVO_STYLES[motivo] ?? DEFAULT_STYLE;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function LossSection({ fechaInicio, fechaFin }: { fechaInicio: string; fechaFin: string }) {
  const [data, setData] = useState<PerdidasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const { refreshCounter } = useAppStore();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiGet<PerdidasData>(
        `/api/perdidas?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`
      );
      setData(result);
    } catch (err) {
      console.error("Error loading perdidas:", err);
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshCounter]);

  const motivos = data ? Object.entries(data.porMotivo) : [];
  const hasExpiryAlerts = (data?.proxVencer.length ?? 0) > 0 || (data?.vencidos.length ?? 0) > 0;

  return (
    <div className="space-y-3">
      {/* Summary cards by motivo */}
      <div className="grid grid-cols-2 gap-2">
        {/* Total pérdida */}
        <Card className="border-none shadow-sm ring-1 ring-red-500/25 bg-red-500/[0.04]">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 bg-red-500/10">
                <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide leading-tight">
                Perdidas
              </span>
            </div>
            {loading ? (
              <div className="h-6 w-3/4 rounded bg-muted animate-pulse" />
            ) : (
              <div className="text-lg font-bold tracking-tight leading-none text-red-600 dark:text-red-400">
                {numToString(data?.totalPerdida ?? 0)}
              </div>
            )}
            {loading ? (
              <div className="h-3 w-1/2 rounded bg-muted animate-pulse mt-1" />
            ) : (
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {data?.items.length ?? 0} registro{data?.items.length !== 1 ? "s" : ""}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Próximos a vencer */}
        <Card className={cn(
          "border-none shadow-sm ring-1",
          hasExpiryAlerts ? "ring-amber-500/25 bg-amber-500/[0.04]" : "ring-border/60 bg-card"
        )}>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <div className={cn(
                "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                hasExpiryAlerts ? "bg-amber-500/10" : "bg-muted"
              )}>
                <AlertTriangle className={cn(
                  "h-4 w-4",
                  hasExpiryAlerts ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                )} />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide leading-tight">
                Vencimientos
              </span>
            </div>
            {loading ? (
              <div className="h-6 w-3/4 rounded bg-muted animate-pulse" />
            ) : (
              <div className={cn(
                "text-lg font-bold tracking-tight leading-none",
                hasExpiryAlerts ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
              )}>
                {(data?.vencidos.length ?? 0) + (data?.proxVencer.length ?? 0)}
              </div>
            )}
            {loading ? (
              <div className="h-3 w-1/2 rounded bg-muted animate-pulse mt-1" />
            ) : (
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {hasExpiryAlerts
                  ? `${data?.vencidos.length ?? 0} vencido${(data?.vencidos.length ?? 0) !== 1 ? "s" : ""}, ${data?.proxVencer.length ?? 0} por vencer`
                  : "Sin alertas"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Motivo breakdown */}
      {motivos.length > 0 && (
        <div className="space-y-1.5">
          {motivos.map(([motivo, info]) => {
            const style = getMotivoStyle(motivo);
            return (
              <div key={motivo} className={cn("flex items-center gap-2 rounded-lg p-2 ring-1", style.ring, style.bg)}>
                <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", style.bg)}>
                  <span className={style.text}>{style.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{motivo}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {info.count} registro{info.count !== 1 ? "s" : ""}
                  </div>
                </div>
                <span className={cn("text-sm font-semibold shrink-0", style.text)}>
                  {numToString(info.total)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Expiry alerts */}
      {data && (data.vencidos.length > 0 || data.proxVencer.length > 0) && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
            Alertas de vencimiento
          </div>
          {data.vencidos.map((p) => (
            <div key={`v-${p.id}`} className="flex items-center gap-2 rounded-lg p-2 ring-1 ring-red-500/25 bg-red-500/[0.04]">
              <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 bg-red-500/10">
                <Package className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{p.Nombre}</div>
                <div className="text-[10px] text-red-600 dark:text-red-400 font-medium">
                  Vencido · Stock: {p.Cantidad ?? 0}
                </div>
              </div>
              <span className="text-xs font-semibold text-red-600 dark:text-red-400 shrink-0">
                {numToString(p.PrecioCosto ?? p.PrecioVenta)}
              </span>
            </div>
          ))}
          {data.proxVencer.map((p) => {
            const days = daysUntil(p.FechaVencimiento);
            return (
              <div key={`p-${p.id}`} className="flex items-center gap-2 rounded-lg p-2 ring-1 ring-amber-500/25 bg-amber-500/[0.04]">
                <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 bg-amber-500/10">
                  <Package className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{p.Nombre}</div>
                  <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    Vence en {days} dia{days !== 1 ? "s" : ""} · Stock: {p.Cantidad ?? 0}
                  </div>
                </div>
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                  {numToString(p.PrecioCosto ?? p.PrecioVenta)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail toggle */}
      {!loading && data && data.items.length > 0 && (
        <>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-1"
          >
            {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showDetails ? "Ocultar detalle" : "Ver detalle de perdidas"}
          </button>

          {showDetails && (
            <div className="space-y-1.5">
              {data.items.map((item, idx) => {
                const style = getMotivoStyle(item.motivo);
                return (
                  <div key={`${item.id}-${idx}`} className={cn("flex items-center gap-2 rounded-lg p-2 ring-1 ring-border/60 bg-card")}>
                    <div className={cn("h-6 w-6 rounded flex items-center justify-center shrink-0", style.bg)}>
                      <span className={cn("text-[10px]", style.text)}>{style.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{item.producto}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {item.cantidad} u · {numToString(item.precioUnitario)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-semibold">{numToString(item.total)}</div>
                      <div className={cn("text-[10px] font-medium", style.text)}>{item.motivo}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}