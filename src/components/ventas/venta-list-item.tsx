import { Documento } from "@/types/database";
import { numToString, fechaString, extraerIniciales, sbsLeft } from "@/lib/format";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface VentaListItemProps {
  venta: Documento;
}

function tiempoRelativo(fechaEmision: string): string {
  const fecha = new Date(fechaEmision + "T12:00:00");
  const hoy = new Date();
  const diffDias = Math.floor((hoy.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDias === 0) return "Hoy";
  if (diffDias === 1) return "Ayer";
  if (diffDias < 7) return `Hace ${diffDias} d.`;
  return fechaString(fecha);
}

export function VentaListItem({ venta }: VentaListItemProps) {
  const isGasto = venta.IdTipoDocumento === 3;
  const isSaldoFavor = venta.IdTipoDocumento === 4; // captura
  const isPagoFavor = venta.IdTipoDocumento === 6; // consumo (no cuenta)
  const violeta = "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400";
  const isCredito = venta.bCredito && !isGasto;
  const nombre = venta.Cliente?.Nombre ?? venta.Concepto ?? venta.Descripcion ?? "Sin nombre";
  const concepto = venta.Concepto ?? venta.Descripcion ?? "";

  // Avatar styles by type
  const avatarBg = isGasto
    ? "bg-destructive/10 text-destructive"
    : isSaldoFavor || isPagoFavor
    ? violeta
    : isCredito
    ? "bg-brand-surface text-brand-dark"
    : "bg-success/10 text-success";

  // Badge
  const badgeLabel = isGasto
    ? "Gasto"
    : isSaldoFavor
    ? "A favor"
    : isPagoFavor
    ? "Pago a favor"
    : isCredito
    ? "Crédito"
    : "Contado";
  const badgeClass = isGasto
    ? "bg-destructive/10 text-destructive"
    : isSaldoFavor || isPagoFavor
    ? violeta
    : isCredito
    ? "bg-brand-surface text-brand-dark"
    : "bg-success/10 text-success";

  // Amount color — la captura (tipo 4) sí es ingreso (verde); el consumo (tipo 6)
  // no cuenta: violeta.
  const amountColor = isGasto
    ? "text-destructive"
    : isPagoFavor
    ? "text-violet-700 dark:text-violet-400"
    : "text-success";

  return (
    <Link
      href={`/venta-detalle/${venta.id}`}
      className="flex items-center gap-3 py-3 px-1 hover:bg-accent/40 rounded-md transition-colors"
    >
      {/* Avatar */}
      <div
        className={cn(
          "h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold",
          avatarBg
        )}
      >
        {extraerIniciales(nombre) || "?"}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate leading-tight">
          {sbsLeft(nombre, 50)}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-muted-foreground">
            {tiempoRelativo(venta.FechaEmision)}
          </span>
          {concepto && concepto !== nombre && (
            <span className="text-[11px] text-muted-foreground/60 truncate">
              {sbsLeft(concepto, 80)}
            </span>
          )}
        </div>
      </div>

      {/* Right: badge + amount */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-sm", badgeClass)}>
          {badgeLabel}
        </span>
        <span className={cn("text-sm font-bold leading-none", amountColor)}>
          {numToString(isGasto ? -Math.abs(venta.Total) : venta.Total)}
        </span>
      </div>
    </Link>
  );
}
