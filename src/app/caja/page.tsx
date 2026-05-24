"use client";

import { useState, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { Caja } from "@/types/database";
import { apiGet, apiPost } from "@/lib/api-client";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { numToString } from "@/lib/format";
import { format } from "date-fns";
import { Landmark, Lock, Unlock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
      {children}
    </label>
  );
}

export default function CajaPage() {
  const router = useRouter();
  const [caja, setCaja] = useState<Caja | null>(null);
  const [loading, setLoading] = useState(true);
  const [montoInicial, setMontoInicial] = useState("");
  const [montoFinal, setMontoFinal] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  async function load() {
    try {
      const data = await apiGet<Caja | null>("/api/caja");
      setCaja(data);
    } catch {
      setCaja(null);
    } finally {
      setLoading(false);
    }
  }

  useLayoutEffect(() => {
    load();
  }, []);

  const handleAbrir = async () => {
    const monto = parseFloat(montoInicial);
    if (isNaN(monto) || monto < 0) {
      toast.error("Ingrese un monto inicial válido");
      return;
    }
    setActionLoading(true);
    try {
      await apiPost("/api/caja/apertura", { montoInicial: monto });
      toast.success("Caja abierta");
      setMontoInicial("");
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCerrar = async () => {
    if (!caja) return;
    const monto = parseFloat(montoFinal);
    if (isNaN(monto) || monto < 0) {
      toast.error("Ingrese un monto final válido");
      return;
    }
    setActionLoading(true);
    try {
      await apiPost("/api/caja/cierre", { id: caja.id, montoFinal: monto });
      toast.success("Caja cerrada");
      setMontoFinal("");
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingState variant="skeleton-detail" count={4} />;

  return (
    <div className="max-w-lg space-y-2">
      <PageHeader title="Control de caja" onBack={() => router.back()} />

      {/* Estado actual */}
      <div
        className={cn(
          "rounded-lg p-3 ring-1",
          caja
            ? "bg-brand-surface ring-brand/30"
            : "bg-muted/50 ring-border"
        )}
      >
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
              caja ? "bg-brand/10" : "bg-muted"
            )}
          >
            <Landmark className={cn("h-5 w-5", caja ? "text-brand" : "text-muted-foreground")} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn("text-sm font-bold", caja ? "text-brand-dark" : "text-muted-foreground")}>
              {caja ? "Caja abierta" : "Sin caja abierta"}
            </p>
            {caja && (
              <p className="text-[11px] text-brand/70 mt-0.5">
                Desde {format(new Date(caja.FechaApertura), "dd/MM/yyyy HH:mm")} · Inicial: {numToString(caja.MontoInicial)}
              </p>
            )}
            {!caja && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Sin caja no se pueden registrar ventas ni abonos
              </p>
            )}
          </div>
          {caja && (
            <div className="text-right shrink-0">
              <div className="text-lg font-extrabold text-brand-dark">{numToString(caja.MontoInicial)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Formulario */}
      <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-3 space-y-2">
        {caja ? (
          <>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Cerrar caja
            </h2>
            <div>
              <FieldLabel>Monto contado</FieldLabel>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium pointer-events-none">$</span>
                <Input
                  id="monto-final"
                  type="number"
                  placeholder="0"
                  value={montoFinal}
                  onChange={(e) => setMontoFinal(e.target.value)}
                  className="h-11 rounded-md pl-7"
                />
              </div>
            </div>
            <Button
              className="w-full h-11 gap-2 bg-destructive hover:bg-destructive/90 text-white font-semibold"
              onClick={handleCerrar}
              disabled={actionLoading}
            >
              <Lock className="h-4 w-4" />
              {actionLoading ? "Cerrando..." : "Cerrar caja"}
            </Button>
          </>
        ) : (
          <>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Abrir caja
            </h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-warning/10 border border-warning/20 rounded-md p-2.5">
              <AlertCircle className="h-4 w-4 text-warning shrink-0" />
              <span>Registra el efectivo con el que inicias el día.</span>
            </div>
            <div>
              <FieldLabel>Monto inicial</FieldLabel>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium pointer-events-none">$</span>
                <Input
                  id="monto-inicial"
                  type="number"
                  placeholder="0"
                  value={montoInicial}
                  onChange={(e) => setMontoInicial(e.target.value)}
                  className="h-11 rounded-md pl-7"
                />
              </div>
            </div>
            <Button
              className="w-full h-11 gap-2 bg-brand hover:bg-brand-dark text-white font-bold"
              onClick={handleAbrir}
              disabled={actionLoading}
            >
              <Unlock className="h-4 w-4" />
              {actionLoading ? "Abriendo..." : "Abrir caja"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
