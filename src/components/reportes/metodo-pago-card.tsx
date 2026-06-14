import { numToString } from "@/lib/format";
import { GrupoMetodo } from "@/lib/reportes";

interface MetodoPagoCardProps {
  grupo: GrupoMetodo;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  );
}

export function MetodoPagoCard({ grupo }: MetodoPagoCardProps) {
  return (
    <div className="rounded-lg p-3 ring-1 bg-white dark:bg-card ring-border/50">
      <span className="text-sm font-bold truncate">{grupo.metodo}</span>

      <div className="mt-2 pt-2 border-t border-border/60 space-y-1.5">
        <Row label="Cantidad de Ventas" value={String(grupo.countVentas)} />
        <Row label="Venta" value={numToString(grupo.venta)} />
        <Row label="Abono" value={numToString(grupo.abonos)} />
      </div>
    </div>
  );
}
