import { numToString } from "@/lib/format";
import {
  Wallet,
  DollarSign,
  CreditCard,
  TrendingDown,
  Clock,
  ShoppingBag,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BalanceCardsProps {
  balance: number;
  efectivo: number;
  abono: number;
  gastos: number;
  cobrosPendientes: number;
  ventasCount: number;
  ventasTotal: number;
}

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
    key: "ventas",
    title: "Ventas",
    icon: ShoppingBag,
    iconBg: "bg-success/10",
    iconColor: "text-success",
    valueColor: "text-success",
  },
  {
    key: "efectivo",
    title: "Efectivo",
    icon: DollarSign,
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    valueColor: "text-emerald-700 dark:text-emerald-400",
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
  {
    key: "gastos",
    title: "Gastos",
    icon: TrendingDown,
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
    valueColor: "text-destructive",
  },
] as const;

export function BalanceCards({
  balance,
  efectivo,
  abono,
  gastos,
  cobrosPendientes,
  ventasCount,
  ventasTotal,
}: BalanceCardsProps) {
  const values: Record<string, number> = {
    balance,
    ventas: ventasTotal,
    efectivo,
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
              "bg-white dark:bg-card rounded-md p-2.5 ring-1 shadow-sm",
              isHighlighted ? "ring-warning/40 bg-warning/5" : "ring-border/50"
            )}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className={cn("h-6 w-6 rounded-full flex items-center justify-center shrink-0", iconBg)}>
                <Icon className={cn("h-3.5 w-3.5", iconColor)} />
              </div>
              <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground leading-tight">
                {title}
              </span>
            </div>
            <div className={cn("text-[15px] font-extrabold leading-tight tracking-tight", valueColor)}>
              {numToString(value)}
            </div>
            {key === "ventas" && (
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {ventasCount} venta{ventasCount !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
