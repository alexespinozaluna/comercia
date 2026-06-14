"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProductoMovimientoAjuste, TipoMovimiento } from "@/types/database";
import { apiGet } from "@/lib/api-client";
import { cantidadString, toInputDate } from "@/lib/format";
import { useAppStore } from "@/stores/app-store";
import { useResource } from "@/hooks/use-resource";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { RegistroBajaForm } from "@/components/kardex/registro-baja-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowDownRight, ArrowUpDown, TrendingDown, TrendingUp, History, Plus, Search } from "lucide-react";

const ALLOWED_ROLES = ["ADMIN", "SUPERVISOR"];

const MOV_STYLE: Record<number, { icon: React.ReactNode; bg: string; text: string; sign: string }> = {
  3: { icon: <TrendingUp className="h-4 w-4" />, bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", sign: "+" },
  4: { icon: <TrendingDown className="h-4 w-4" />, bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", sign: "-" },
  5: { icon: <ArrowDownRight className="h-4 w-4" />, bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", sign: "-" },
  6: { icon: <ArrowUpDown className="h-4 w-4" />, bg: "bg-sky-500/10", text: "text-sky-600 dark:text-sky-400", sign: "±" },
};

function getMovInfo(tipo: number, tipos: TipoMovimiento[]) {
  const meta = tipos.find((t) => t.Id === tipo);
  const style = MOV_STYLE[tipo] ?? { icon: <History className="h-4 w-4" />, bg: "bg-muted", text: "text-muted-foreground", sign: "" };
  return { label: meta?.Descripcion ?? "Otro", ...style };
}

export default function AjustesPage() {
  const router = useRouter();
  const user = useAppStore((s) => s.authUser);
  const allowed = !!user && ALLOWED_ROLES.includes(user.rol);
  const refreshCounter = useAppStore((s) => s.refreshCounter);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"baja" | "inventario">("baja");
  const [initialProductId, setInitialProductId] = useState<number | undefined>(undefined);

  const [fechaInicio, setFechaInicio] = useState(() => {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return toInputDate(monthAgo);
  });
  const [fechaFin, setFechaFin] = useState(() => toInputDate());

  // ?producto= (botón "Ajustar Stock" del detalle): abre el sheet de baja una vez.
  useEffect(() => {
    if (!allowed) return;
    const pid = parseInt(new URLSearchParams(window.location.search).get("producto") ?? "", 10);
    if (Number.isFinite(pid) && pid > 0) {
      setInitialProductId(pid);
      setSheetMode("baja");
      setSheetOpen(true);
    }
  }, [allowed]);

  const { data, loading } = useResource(async () => {
    if (!allowed) {
      return { movimientos: [] as ProductoMovimientoAjuste[], tiposMovimiento: [] as TipoMovimiento[] };
    }
    const [movs, tiposData] = await Promise.all([
      apiGet<ProductoMovimientoAjuste[]>(`/api/ajustes?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`),
      apiGet<TipoMovimiento[]>("/api/tipo-movimiento"),
    ]);
    return { movimientos: movs ?? [], tiposMovimiento: tiposData ?? [] };
  }, [allowed, fechaInicio, fechaFin, refreshCounter]);
  const movimientos = data?.movimientos ?? [];
  const tiposMovimiento = data?.tiposMovimiento ?? [];

  const openSheet = (mode: "baja" | "inventario") => {
    setSheetMode(mode);
    setSheetOpen(true);
  };

  const term = search.trim().toLowerCase();
  const filtered = term
    ? movimientos.filter((m) => (m.ProductoNombre ?? "").toLowerCase().includes(term))
    : movimientos;

  // Access check
  if (user && !ALLOWED_ROLES.includes(user.rol)) {
    return (
      <div className="space-y-2">
        <PageHeader title="Ajustes de Inventario" onBack={() => router.back()} breadcrumbs={[{ label: "Stock", href: "/producto" }, { label: "Ajustes" }]} />
        <EmptyState title="Acceso restringido" description="Solo administradores y supervisores pueden acceder a este modulo." />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <PageHeader
        title="Ajustes de Inventario"
        onBack={() => router.back()}
        breadcrumbs={[{ label: "Stock", href: "/producto" }, { label: "Ajustes" }]}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openSheet("inventario")}>
              <ArrowUpDown className="h-4 w-4" /> Inventario
            </Button>
            <Button size="sm" className="shadow-sm gap-1.5" onClick={() => openSheet("baja")}>
              <Plus className="h-4 w-4" /> Baja
            </Button>
          </div>
        }
      />

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

      {/* Product search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 text-sm pl-8"
        />
      </div>

      {/* Count */}
      <div className="text-xs text-muted-foreground">
        {filtered.length} ajuste{filtered.length !== 1 ? "s" : ""}
        {term && ` · "${search.trim()}"`}
      </div>

      {user == null || loading ? (
        <LoadingState variant="skeleton-list" count={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={History}
          title="Sin ajustes"
          description={term ? "Ningún ajuste coincide con la búsqueda." : "No se encontraron ajustes en el rango seleccionado."}
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
                  m.TipoMovimiento === 4 ? "ring-amber-500/25" : m.TipoMovimiento === 3 ? "ring-sky-500/25" : "ring-purple-500/25"
                )}
              >
                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", info.bg)}>
                  <span className={info.text}>{info.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{m.ProductoNombre ?? "Producto"}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", info.bg, info.text)}>
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
                    <span className={cn("font-bold", info.text)}>
                      {info.sign}{cantidadString(m.Cantidad)}
                    </span>
                    <span className="text-muted-foreground">
                      Stock: <span className="font-medium text-foreground">{cantidadString(m.StockAnterior)}</span>
                      {" → "}
                      <span className={cn("font-bold", m.StockNuevo < m.StockAnterior ? "text-amber-600" : "text-sky-600")}>
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

      <RegistroBajaForm
        open={sheetOpen}
        onOpenChange={(v) => {
          setSheetOpen(v);
          if (!v) {
            setInitialProductId(undefined);
            // Limpiar ?producto= de la URL para que no reabra al refrescar
            if (window.location.search) {
              window.history.replaceState(null, "", window.location.pathname);
            }
          }
        }}
        initialMode={sheetMode}
        initialProductId={initialProductId}
      />
    </div>
  );
}
