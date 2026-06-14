import { numToString } from "@/lib/format";
import { Wallet, ShoppingBag, DollarSign, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { TotalesIngresos } from "@/lib/reportes";

interface TotalesIngresosCardsProps {
  totales: TotalesIngresos;
}

const CARDS = [
  { key: "balance", title: "Balance", icon: Wallet, iconBg: "bg-brand/10", iconColor: "text-brand", valueColor: "text-brand-dark" },
  { key: "ventas", title: "Ventas", icon: ShoppingBag, iconBg: "bg-success/10", iconColor: "text-success", valueColor: "text-success" },
  { key: "efectivo", title: "Efectivo", icon: DollarSign, iconBg: "bg-emerald-500/10", iconColor: "text-emerald-600 dark:text-emerald-400", valueColor: "text-emerald-700 dark:text-emerald-400" },
  { key: "abono", title: "Abono", icon: CreditCard, iconBg: "bg-info/10", iconColor: "text-info", valueColor: "text-info" },
] as const;

/** Totales del reporte de ingresos, mismo lenguaje visual que BalanceCards (home). */
export function TotalesIngresosCards({ totales }: TotalesIngresosCardsProps) {
  const values: Record<string, number> = {
    balance: totales.balance,
    ventas: totales.ventas,
    efectivo: totales.efectivo,
    abono: totales.abono,
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {CARDS.map(({ key, title, icon: Icon, iconBg, iconColor, valueColor }) => (
        <div key={key} className="bg-white dark:bg-card rounded-md p-1.5 sm:p-2.5 ring-1 ring-border/50 shadow-sm">
          <div className="flex items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1.5">
            <div className={cn("h-4 w-4 sm:h-6 sm:w-6 rounded-full flex items-center justify-center shrink-0", iconBg)}>
              <Icon className={cn("h-2.5 w-2.5 sm:h-3.5 sm:w-3.5", iconColor)} />
            </div>
            <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground leading-tight truncate">
              {title}
            </span>
          </div>
          <div className={cn("text-[13px] sm:text-[15px] font-extrabold leading-tight tracking-tight", valueColor)}>
            {numToString(values[key])}
          </div>
        </div>
      ))}
    </div>
  );
}
