"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Caja, CajaArqueo, CajaHistorialItem } from "@/types/database";
import { apiGet } from "@/lib/api-client";
import { useAppStore } from "@/stores/app-store";
import { useResource } from "@/hooks/use-resource";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { numToString, toInputDate } from "@/lib/format";
import { format } from "date-fns";
import { CheckCircle2, AlertTriangle, XCircle, Filter, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const ALLOWED_ROLES = ["ADMIN", "SUPERVISOR"];
const UMBRAL = 1; // |diferencia| ≤ 1 cuenta como "cuadra"

/** Categoriza una diferencia para estilos y semántica. */
function categoria(diff: number | null): "cuadra" | "sobra" | "falta" | "abierta" {
  if (diff == null) return "abierta";
  if (Math.abs(diff) <= UMBRAL) return "cuadra";
  return diff > 0 ? "sobra" : "falta";
}

const STYLE: Record<
  "cuadra" | "sobra" | "falta" | "abierta",
  { chip: string; icon: React.ReactNode; label: string }
> = {
  cuadra: {
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    label: "Cuadra",
  },
  sobra: {
    chip: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    label: "Sobrante",
  },
  falta: {
    chip: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900",
    icon: <XCircle className="h-3.5 w-3.5" />,
    label: "Faltante",
  },
  abierta: {
    chip: "bg-brand-surface text-brand-dark ring-brand/30",
    icon: <History className="h-3.5 w-3.5" />,
    label: "Abierta",
  },
};

// Fecha LOCAL (no UTC) para los rangos por defecto: toInputDate evita el
// salto de día de toISOString() en zonas negativas (es-CL).
function todayIso(): string {
  return toInputDate();
}
function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toInputDate(d);
}

export default function CajaHistorialPage() {
  const router = useRouter();

  const user = useAppStore((s) => s.authUser);
  const allowed = !!user && ALLOWED_ROLES.includes(user.rol);

  const [desde, setDesde] = useState(isoDaysAgo(30));
  const [hasta, setHasta] = useState(todayIso());
  const [usuarioFilter, setUsuarioFilter] = useState<string>("0"); // "0" = todos
  const [soloDescuadre, setSoloDescuadre] = useState(false);

  const [detail, setDetail] = useState<{ caja: CajaHistorialItem; arqueo: CajaArqueo } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const { data, loading } = useResource(async () => {
    if (!allowed) return [] as CajaHistorialItem[];
    const params = new URLSearchParams();
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    if (usuarioFilter !== "0") params.set("usuario", usuarioFilter);
    if (soloDescuadre) params.set("descuadre", "1");
    return apiGet<CajaHistorialItem[]>(`/api/caja/historial?${params.toString()}`);
  }, [allowed, desde, hasta, usuarioFilter, soloDescuadre]);
  const rows = useMemo(() => data ?? [], [data]);

  // Lista de cajeros distintos (de las filas cargadas) para el filtro
  const cajeros = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of rows) {
      if (r.IdUsuarioApertura && r.NomUsuarioApertura)
        map.set(r.IdUsuarioApertura, r.NomUsuarioApertura);
      if (r.IdUsuarioCierre && r.NomUsuarioCierre)
        map.set(r.IdUsuarioCierre, r.NomUsuarioCierre);
    }
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [rows]);

  // Indicadores
  const resumen = useMemo(() => {
    const cerradas = rows.filter((r) => r.Estado === 0);
    let cuadradas = 0,
      sumFaltantes = 0,
      sumSobrantes = 0;
    for (const r of cerradas) {
      const d = r.Diferencia ?? 0;
      const cat = categoria(d);
      if (cat === "cuadra") cuadradas++;
      else if (cat === "falta") sumFaltantes += -d;
      else if (cat === "sobra") sumSobrantes += d;
    }
    return {
      total: cerradas.length,
      cuadradas,
      pctCuadradas: cerradas.length ? Math.round((cuadradas / cerradas.length) * 100) : 0,
      sumFaltantes,
      sumSobrantes,
    };
  }, [rows]);

  const openDetail = async (caja: CajaHistorialItem) => {
    setDetailLoading(true);
    setDetail({ caja, arqueo: null as unknown as CajaArqueo });
    try {
      const arqueo = await apiGet<CajaArqueo>(`/api/caja/arqueo?id=${caja.id}`);
      setDetail({ caja, arqueo });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al cargar arqueo");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // Access control
  if (user && !ALLOWED_ROLES.includes(user.rol)) {
    return (
      <div className="max-w-lg">
        <PageHeader title="Historial de caja" onBack={() => router.back()} />
        <EmptyState
          title="Acceso restringido"
          description="Solo administradores y supervisores pueden ver el historial."
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-3">
      <PageHeader title="Historial de caja" onBack={() => router.back()} />

      {/* Filtros */}
      <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> Filtros
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-semibold uppercase text-muted-foreground mb-1">Desde</label>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-10" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase text-muted-foreground mb-1">Hasta</label>
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-10" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 items-end">
          <div>
            <label className="block text-[11px] font-semibold uppercase text-muted-foreground mb-1">Cajero</label>
            <Select value={usuarioFilter} onValueChange={(v) => setUsuarioFilter(v ?? "0")}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Todos</SelectItem>
                {cajeros.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 h-10 px-2 cursor-pointer">
            <Checkbox
              checked={soloDescuadre}
              onCheckedChange={(v) => setSoloDescuadre(v === true)}
            />
            <span className="text-sm">Solo con descuadre</span>
          </label>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <ResumenCard label="Cierres" value={String(resumen.total)} />
        <ResumenCard label="% cuadrados" value={`${resumen.pctCuadradas}%`} tone="ok" />
        <ResumenCard label="Σ faltantes" value={numToString(resumen.sumFaltantes)} tone={resumen.sumFaltantes > 0 ? "bad" : undefined} />
        <ResumenCard label="Σ sobrantes" value={numToString(resumen.sumSobrantes)} tone={resumen.sumSobrantes > 0 ? "warn" : undefined} />
      </div>

      {/* Lista */}
      {user == null || loading ? (
        <LoadingState variant="skeleton-detail" count={5} />
      ) : rows.length === 0 ? (
        <EmptyState title="Sin cierres en el rango" description="Ajusta los filtros." />
      ) : (
        <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 divide-y divide-border">
          {rows.map((r) => {
            const cat = categoria(r.Estado === 1 ? null : r.Diferencia);
            const s = STYLE[cat];
            return (
              <button
                key={r.id}
                onClick={() => openDetail(r)}
                className="w-full text-left p-3 hover:bg-muted/40 transition-colors flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">
                      {format(new Date(r.FechaApertura), "dd/MM/yyyy HH:mm")}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ring-1",
                        s.chip,
                      )}
                    >
                      {s.icon} {s.label}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {r.NomUsuarioApertura ?? `Usr ${r.IdUsuarioApertura}`}
                    {r.FechaCierre && r.NomUsuarioCierre && r.NomUsuarioCierre !== r.NomUsuarioApertura
                      ? ` → ${r.NomUsuarioCierre}`
                      : ""}
                    {r.FechaCierre
                      ? ` · cerró ${format(new Date(r.FechaCierre), "dd/MM HH:mm")}`
                      : " · abierta"}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-mono tabular-nums font-bold">
                    {r.Diferencia != null
                      ? `${r.Diferencia > 0 ? "+" : ""}${numToString(r.Diferencia)}`
                      : "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono tabular-nums">
                    esp {numToString(r.MontoEsperado ?? 0)} / cnt {numToString(r.MontoFinal ?? 0)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Detalle */}
      <Sheet open={!!detail} onOpenChange={(v) => { if (!v) setDetail(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Arqueo del cierre</SheetTitle>
            <SheetDescription>
              {detail?.caja &&
                `Caja #${detail.caja.id} · ${format(new Date(detail.caja.FechaApertura), "dd/MM/yyyy HH:mm")}`}
            </SheetDescription>
          </SheetHeader>
          {detail && detail.arqueo ? (
            <DetalleArqueo caja={detail.caja} arqueo={detail.arqueo} />
          ) : detailLoading ? (
            <div className="p-4">
              <LoadingState variant="skeleton-detail" count={3} />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ResumenCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "bad";
}) {
  const toneClass =
    tone === "ok"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-700 dark:text-amber-400"
        : tone === "bad"
          ? "text-red-700 dark:text-red-400"
          : "";
  return (
    <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={cn("text-lg font-bold font-mono tabular-nums mt-0.5", toneClass)}>
        {value}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  sign,
  muted,
}: {
  label: string;
  value: number;
  sign?: "+" | "−" | "=";
  muted?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between text-sm", muted && "text-muted-foreground")}>
      <span className="flex items-center gap-1.5">
        {sign && <span className="w-3 text-center font-mono">{sign}</span>}
        {label}
      </span>
      <span className="font-mono tabular-nums">{numToString(value)}</span>
    </div>
  );
}

function DetalleArqueo({ caja, arqueo }: { caja: Caja; arqueo: CajaArqueo }) {
  const diff = caja.Diferencia ?? 0;
  const cat = categoria(caja.Estado === 1 ? null : diff);
  const s = STYLE[cat];
  return (
    <div className="p-4 space-y-3">
      <div className="rounded-md bg-muted/40 ring-1 ring-border p-3 space-y-1">
        <Row label="Monto inicial" value={arqueo.MontoInicial} sign="+" muted />
        <Row label={`Ventas efectivo (${arqueo.CntVentas})`} value={arqueo.VentasEfectivo} sign="+" muted />
        <Row label={`Abonos efectivo (${arqueo.CntAbonos})`} value={arqueo.AbonosEfectivo} sign="+" muted />
        <Row label={`Gastos efectivo (${arqueo.CntGastos})`} value={arqueo.GastosEfectivo} sign="−" muted />
        <div className="border-t border-border/60 my-1" />
        <div className="flex items-center justify-between text-sm font-bold">
          <span className="flex items-center gap-1.5">
            <span className="w-3 text-center font-mono">=</span>
            Esperado
          </span>
          <span className="font-mono tabular-nums">{numToString(arqueo.MontoEsperado)}</span>
        </div>
        <Row label="Contado" value={caja.MontoFinal ?? 0} />
      </div>

      <div
        className={cn(
          "flex items-center justify-between rounded-md p-2.5 text-sm font-semibold ring-1",
          s.chip,
        )}
      >
        <span className="flex items-center gap-1.5">
          {s.icon} {s.label}
        </span>
        <span className="font-mono tabular-nums">
          {diff > 0 ? "+" : ""}
          {numToString(diff)}
        </span>
      </div>

      {caja.Observacion && (
        <div className="rounded-md ring-1 ring-border p-2.5 text-sm">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Observación
          </div>
          <div className="mt-1 whitespace-pre-wrap">{caja.Observacion}</div>
        </div>
      )}
    </div>
  );
}
