import { numToString } from "@/lib/format";
import { GrupoUsuario } from "@/lib/reportes";

interface UsuarioCardProps {
  grupo: GrupoUsuario;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  );
}

/** Card por usuario del reporte de ventas: ventas / abono / gastos / balance. */
export function UsuarioCard({ grupo }: UsuarioCardProps) {
  return (
    <div className="rounded-lg p-3 ring-1 bg-white dark:bg-card ring-border/50">
      <span className="text-sm font-bold truncate">{grupo.usuario}</span>

      <div className="mt-2 pt-2 border-t border-border/60 space-y-1.5">
        <Row label="Cantidad de ventas" value={String(grupo.countVentas)} />
        <Row label="Ventas" value={numToString(grupo.ventas)} />
        <Row label="Abono" value={numToString(grupo.abonos)} />
        <Row label="Gastos" value={numToString(grupo.gastos)} />
        <div className="pt-1.5 border-t border-border/60">
          <Row label="Balance" value={numToString(grupo.balance)} />
        </div>
      </div>
    </div>
  );
}
