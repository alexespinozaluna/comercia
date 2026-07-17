import { numToString } from "@/lib/format";
import {
  Wallet,
  TrendingUp,
  CreditCard,
  TrendingDown,
  Clock,
  ShoppingBag,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BalanceCardsProps {
  balance: number;
  ingresos: number;
  abono: number;
  gastos: number;
  cobrosPendientes: number;
  ventasCount: number;
  ventasTotal: number;
}

// Fila 1 — la cuenta del día: Balance = Ingresos − Gastos (verificable a ojo).
// Fila 2 — el detalle: Ventas (facturado), Pendiente (fiado), Abono (desglose
// de Ingresos que viene de deudas anteriores).
const CARDS = [
  {
    key: "balance",
    title: "Balance",
    icon: Wallet,
    iconBg: "bg-brand/10",
    iconColor: "text-brand",
    valueColor: "text-brand-dark",
  },
  {
    key: "ingresos",
    title: "Ingresos",
    icon: TrendingUp,
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    valueColor: "text-emerald-700 dark:text-emerald-400",
  },
  {
    key: "gastos",
    title: "Gastos",
    icon: TrendingDown,
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
    valueColor: "text-destructive",
  },
  {
    key: "ventas",
    title: "Ventas",
    icon: ShoppingBag,
    iconBg: "bg-success/10",
    iconColor: "text-success",
    valueColor: "text-success",
  },
  {
    key: "pendiente",
    title: "Pendiente",
    icon: Clock,
    iconBg: "bg-warning/10",
    iconColor: "text-warning",
    valueColor: "text-warning",
    highlight: true,
  },
  {
    key: "abono",
    title: "Abono",
    icon: CreditCard,
    iconBg: "bg-info/10",
    iconColor: "text-info",
    valueColor: "text-info",
  },
] as const;

export function BalanceCards({
  balance,
  ingresos,
  abono,
  gastos,
  cobrosPendientes,
  ventasCount,
  ventasTotal,
}: BalanceCardsProps) {
  const values: Record<string, number> = {
    balance,
    ventas: ventasTotal,
    ingresos,
    pendiente: cobrosPendientes,
    abono,
    gastos,
  };

  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
      {CARDS.map((card) => {
        const { key, title, icon: Icon, iconBg, iconColor, valueColor } = card;
        const highlight = "highlight" in card && card.highlight;
        const value = values[key] ?? 0;
        const isHighlighted = highlight && value > 0;
        return (
          <div
            key={key}
            className={cn(
              "bg-white dark:bg-card rounded-md p-1.5 sm:p-2.5 ring-1 shadow-sm",
              isHighlighted ? "ring-warning/40 bg-warning/5" : "ring-border/50"
            )}
          >
            <div className="flex items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1.5">
              <div className={cn("h-4 w-4 sm:h-6 sm:w-6 rounded-full flex items-center justify-center shrink-0", iconBg)}>
                <Icon className={cn("h-2.5 w-2.5 sm:h-3.5 sm:w-3.5", iconColor)} />
              </div>
              <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground leading-tight truncate">
                {title}
              </span>
            </div>
            <div className={cn("text-[13px] sm:text-[15px] font-extrabold leading-tight tracking-tight", valueColor)}>
              {numToString(value)}
            </div>
            {key === "ventas" && (
              <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                {ventasCount} venta{ventasCount !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
