"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Producto, ProductoMovimiento, TipoMovimiento } from "@/types/database";
import { apiGet } from "@/lib/api-client";
import { toInputDate, cantidadString } from "@/lib/format";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, ArrowUpDown, TrendingUp, TrendingDown, History, Package } from "lucide-react";

const TIPO_OPTIONS = [
  { value: "Todos", label: "Todos" },
  { value: "INGRESO", label: "Ingresos" },
  { value: "SALIDA", label: "Salidas" },
  { value: "AJUSTE", label: "Ajustes" },
] as const;

type TipoFilter = (typeof TIPO_OPTIONS)[number]["value"];

interface MovimientoInfo {
  label: string;
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
  ringColor: string;
  sign: string;
}

const MOV_STYLE: Record<number, Omit<MovimientoInfo, "label">> = {
  1: { icon: <ArrowDownRight className="h-4 w-4" />, bgColor: "bg-amber-500/10", textColor: "text-amber-600 dark:text-amber-400", ringColor: "ring-amber-500/25", sign: "-" },
  2: { icon: <ArrowUpRight className="h-4 w-4" />, bgColor: "bg-emerald-500/10", textColor: "text-emerald-600 dark:text-emerald-400", ringColor: "ring-emerald-500/25", sign: "+" },
  3: { icon: <TrendingUp className="h-4 w-4" />, bgColor: "bg-emerald-500/10", textColor: "text-emerald-600 dark:text-emerald-400", ringColor: "ring-emerald-500/25", sign: "+" },
  4: { icon: <TrendingDown className="h-4 w-4" />, bgColor: "bg-red-500/10", textColor: "text-red-600 dark:text-red-400", ringColor: "ring-red-500/25", sign: "-" },
  5: { icon: <ArrowDownRight className="h-4 w-4" />, bgColor: "bg-orange-500/10", textColor: "text-orange-600 dark:text-orange-400", ringColor: "ring-orange-500/25", sign: "-" },
  6: { icon: <ArrowUpDown className="h-4 w-4" />, bgColor: "bg-sky-500/10", textColor: "text-sky-600 dark:text-sky-400", ringColor: "ring-sky-500/25", sign: "±" },
};

function getMovInfo(tipo: number, tipos: TipoMovimiento[]): MovimientoInfo {
  const meta = tipos?.find((t) => t.Id === tipo);
  const style = MOV_STYLE[tipo] ?? { icon: <History className="h-4 w-4" />, bgColor: "bg-muted", textColor: "text-muted-foreground", ringColor: "ring-border", sign: "" };
  return { label: meta?.Descripcion ?? "Otro", ...style };
}

export default function KardexPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [producto, setProducto] = useState<Producto | null>(null);
  const [movimientos, setMovimientos] = useState<ProductoMovimiento[]>([]);
  const [tiposMovimiento, setTiposMovimiento] = useState<TipoMovimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [productId, setProductId] = useState<string>("0");

  const [fechaInicio, setFechaInicio] = useState(() => {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return toInputDate(monthAgo);
  });
  const [fechaFin, setFechaFin] = useState(() => toInputDate());
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>("Todos");

  useEffect(() => {
    params.then((p) => setProductId(p.id));
  }, [params]);

  const loadKardex = useCallback(async () => {
    if (productId === "0") return;
    setLoading(true);
    try {
      const [prodData, movData, tiposData] = await Promise.all([
        apiGet<Producto | null>(`/api/productos/${productId}`),
        apiGet<ProductoMovimiento[]>(
          `/api/kardex/${productId}?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`
        ),
        apiGet<TipoMovimiento[]>("/api/tipo-movimiento"),
      ]);
      setProducto(prodData);
      setMovimientos(movData ?? []);
      setTiposMovimiento(tiposData ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [productId, fechaInicio, fechaFin]);

  useEffect(() => {
    loadKardex();
  }, [loadKardex]);

  const filtered = tipoFilter === "Todos"
    ? movimientos
    : movimientos.filter((m) => {
        const tipo = tiposMovimiento.find((t) => t.Id === m.TipoMovimiento);
        return tipo?.Operacion === tipoFilter;
      });

  const productName = producto?.Nombre ?? "Producto";

  return (
    <div className="space-y-2">
      <PageHeader
        title={productName}
        onBack={() => router.back()}
        breadcrumbs={[
          { label: "Stock", href: "/producto" },
          { label: "Kardex" },
        ]}
      />

      {/* Product info card */}
      {producto && (
        <div className="flex items-center gap-2 p-3 rounded-xl border ring-1 ring-border/60 bg-card">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{producto.Nombre}</div>
            <div className="text-xs text-muted-foreground">
              {producto.Cantidad != null ? `Stock actual: ${cantidadString(producto.Cantidad)}` : "Stock no rastreado"}
            </div>
          </div>
        </div>
      )}

      {/* Date range filter */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
        <div className="flex-1">
          <Input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* Movement type filter */}
      <div className="flex gap-1.5">
        {TIPO_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={tipoFilter === opt.value ? "default" : "outline"}
            size="sm"
            className={cn(
              "flex-1 h-8 text-xs font-medium",
              tipoFilter === opt.value && "shadow-sm"
            )}
            onClick={() => setTipoFilter(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Movement count */}
      <div className="text-xs text-muted-foreground">
        {filtered.length} movimiento{filtered.length !== 1 ? "s" : ""}
        {tipoFilter !== "Todos" && ` · ${TIPO_OPTIONS.find((t) => t.value === tipoFilter)?.label.toLowerCase()}`}
      </div>

      {/* Movement cards */}
      {loading ? (
        <LoadingState variant="skeleton-list" count={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={History}
          title="Sin movimientos"
          description="No se encontraron movimientos para los filtros seleccionados."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => {
            const info = getMovInfo(m.TipoMovimiento, tiposMovimiento);
            return (
              <div
                key={m.id}
                className={cn(
                  "flex items-start gap-2 p-3 rounded-xl border ring-1 transition-all",
                  "hover:shadow-sm",
                  info.ringColor
                )}
              >
                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", info.bgColor)}>
                  <span className={info.textColor}>{info.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", info.bgColor, info.textColor)}>
                      {info.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(m.Fecha), "dd MMM yyyy · HH:mm", { locale: es })}
                    </span>
                  </div>
                  {m.Observacion && (
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{m.Observacion}</div>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 text-xs">
                    <span className={cn("font-bold", info.textColor)}>
                      {info.sign}{cantidadString(m.Cantidad)}
                    </span>
                    <span className="text-muted-foreground">
                      Stock: <span className="font-medium text-foreground">{cantidadString(m.StockAnterior)}</span>
                      {" → "}
                      <span className={cn("font-bold", m.StockNuevo < m.StockAnterior ? "text-amber-600" : m.StockNuevo > m.StockAnterior ? "text-emerald-600" : "text-foreground")}>
                        {cantidadString(m.StockNuevo)}
                      </span>
                    </span>
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