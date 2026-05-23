import { Card, CardContent } from "@/components/ui/card";
import { numToString } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TrendingUp, Clock, AlertTriangle } from "lucide-react";

interface QuickMetricCardsProps {
  ventasHoy: number;
  ventasHoyCount: number;
  porCobrar: number;
  stockCritico: number;
  loading?: boolean;
}

const VARIANT_STYLES = {
  success: {
    iconBg: "bg-emerald-500/10 dark:bg-emerald-500/15",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    valueColor: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/25",
    bg: "bg-emerald-500/[0.04]",
  },
  warning: {
    iconBg: "bg-amber-500/10 dark:bg-amber-500/15",
    iconColor: "text-amber-600 dark:text-amber-400",
    valueColor: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/25",
    bg: "bg-amber-500/[0.04]",
  },
  danger: {
    iconBg: "bg-red-500/10 dark:bg-red-500/15",
    iconColor: "text-red-600 dark:text-red-400",
    valueColor: "text-red-600 dark:text-red-400",
    ring: "ring-red-500/25",
    bg: "bg-red-500/[0.04]",
  },
};

export function QuickMetricCards({
  ventasHoy,
  ventasHoyCount,
  porCobrar,
  stockCritico,
  loading,
}: QuickMetricCardsProps) {
  const cards = [
    {
      title: "Ventas hoy",
      value: loading ? null : numToString(ventasHoy),
      subtitle: loading ? null : `${ventasHoyCount} venta${ventasHoyCount !== 1 ? "s" : ""}`,
      icon: TrendingUp,
      variant: "success" as const,
      href: "/venta",
    },
    {
      title: "Por cobrar",
      value: loading ? null : numToString(porCobrar),
      subtitle: loading ? null : porCobrar > 0 ? "Deudas pendientes" : "Sin deudas",
      icon: Clock,
      variant: "warning" as const,
      href: "/deuda",
    },
    {
      title: "Stock cr\u00edtico",
      value: loading ? null : stockCritico.toString(),
      subtitle: loading ? null : stockCritico > 0 ? "Productos con stock bajo" : "Todo abastecido",
      icon: AlertTriangle,
      variant: "danger" as const,
      href: "/producto",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map(({ title, value, subtitle, icon: Icon, variant }) => {
        const s = VARIANT_STYLES[variant];
        return (
          <Card key={title} className={cn("border-none shadow-sm ring-1", s.ring, s.bg)}>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", s.iconBg)}>
                  <Icon className={cn("h-4 w-4", s.iconColor)} />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide leading-tight">
                  {title}
                </span>
              </div>
              {loading ? (
                <div className="h-6 w-3/4 rounded bg-muted animate-pulse" />
              ) : (
                <div className={cn("text-lg font-bold tracking-tight leading-none", s.valueColor)}>
                  {value}
                </div>
              )}
              {loading ? (
                <div className="h-3 w-1/2 rounded bg-muted animate-pulse mt-1" />
              ) : (
                <div className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}