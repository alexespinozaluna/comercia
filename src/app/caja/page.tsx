"use client";

import { useState, useLayoutEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Caja, CajaArqueo } from "@/types/database";
import { apiGet, apiPost } from "@/lib/api-client";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { numToString } from "@/lib/format";
import { format } from "date-fns";
import { Landmark, Lock, Unlock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Umbral en moneda para advertir antes de cerrar con diferencia. */
const DIFERENCIA_UMBRAL = 1;

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
      {children}
    </label>
  );
}

function BreakdownRow({
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
    <div
      className={cn(
        "flex items-center justify-between text-sm",
        muted && "text-muted-foreground",
      )}
    >
      <span className="flex items-center gap-1.5">
        {sign && <span className="w-3 text-center font-mono">{sign}</span>}
        {label}
      </span>
      <span className="font-mono tabular-nums">{numToString(value)}</span>
    </div>
  );
}

export default function CajaPage() {
  const router = useRouter();
  const [caja, setCaja] = useState<Caja | null>(null);
  const [arqueo, setArqueo] = useState<CajaArqueo | null>(null);
  const [loading, setLoading] = useState(true);
  const [montoInicial, setMontoInicial] = useState("");
  const [montoFinal, setMontoFinal] = useState("");
  const [observacion, setObservacion] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  async function load() {
    try {
      const data = await apiGet<Caja | null>("/api/caja");
      setCaja(data);
      if (data) {
        try {
          const ar = await apiGet<CajaArqueo>(`/api/caja/arqueo?id=${data.id}`);
          setArqueo(ar);
        } catch {
          setArqueo(null);
        }
      } else {
        setArqueo(null);
      }
    } catch {
      setCaja(null);
      setArqueo(null);
    } finally {
      setLoading(false);
    }
  }

  useLayoutEffect(() => {
    load();
  }, []);

  // Diferencia en vivo según lo que tecleó el cajero
  const diferencia = useMemo(() => {
    const m = parseFloat(montoFinal);
    if (!arqueo || !Number.isFinite(m)) return null;
    return +(m - arqueo.MontoEsperado).toFixed(2);
  }, [montoFinal, arqueo]);

  const handleAbrir = async () => {
    const monto = parseFloat(montoInicial);
    if (!Number.isFinite(monto) || monto < 0) {
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
    if (!Number.isFinite(monto) || monto < 0) {
      toast.error("Ingrese un monto final válido");
      return;
    }

    // Si hay descuadre relevante, pedir confirmación explícita
    if (diferencia != null && Math.abs(diferencia) > DIFERENCIA_UMBRAL) {
      const tipo = diferencia > 0 ? "sobrante" : "faltante";
      const ok = window.confirm(
        `Hay un ${tipo} de ${numToString(Math.abs(diferencia))}. ` +
          `¿Cerrar la caja de todas formas?`,
      );
      if (!ok) return;
    }

    setActionLoading(true);
    try {
      await apiPost("/api/caja/cierre", {
        id: caja.id,
        montoFinal: monto,
        observacion: observacion || null,
      });
      toast.success("Caja cerrada");
      setMontoFinal("");
      setObservacion("");
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
            : "bg-muted/50 ring-border",
        )}
      >
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
              caja ? "bg-brand/10" : "bg-muted",
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
        </div>
      </div>

      {/* Formulario */}
      <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-3 space-y-3">
        {caja ? (
          <>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Cerrar caja
            </h2>

            {/* Desglose esperado */}
            {arqueo && (
              <div className="rounded-md bg-muted/40 ring-1 ring-border p-3 space-y-1">
                <BreakdownRow label="Monto inicial" value={arqueo.MontoInicial} sign="+" muted />
                <BreakdownRow
                  label={`Ventas efectivo (${arqueo.CntVentas})`}
                  value={arqueo.VentasEfectivo}
                  sign="+"
                  muted
                />
                <BreakdownRow
                  label={`Abonos efectivo (${arqueo.CntAbonos})`}
                  value={arqueo.AbonosEfectivo}
                  sign="+"
                  muted
                />
                <BreakdownRow
                  label={`Gastos efectivo (${arqueo.CntGastos})`}
                  value={arqueo.GastosEfectivo}
                  sign="−"
                  muted
                />
                <div className="border-t border-border/60 my-1" />
                <div className="flex items-center justify-between text-sm font-bold">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 text-center font-mono">=</span>
                    Esperado en cajón
                  </span>
                  <span className="font-mono tabular-nums">
                    {numToString(arqueo.MontoEsperado)}
                  </span>
                </div>
              </div>
            )}

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

            {/* Diferencia en vivo */}
            {diferencia != null && (
              <div
                className={cn(
                  "flex items-center justify-between rounded-md p-2.5 text-sm font-semibold ring-1",
                  Math.abs(diferencia) <= DIFERENCIA_UMBRAL
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900"
                    : diferencia > 0
                      ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900"
                      : "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900",
                )}
              >
                <span>
                  {Math.abs(diferencia) <= DIFERENCIA_UMBRAL
                    ? "Cuadra"
                    : diferencia > 0
                      ? "Sobrante"
                      : "Faltante"}
                </span>
                <span className="font-mono tabular-nums">
                  {diferencia > 0 ? "+" : ""}
                  {numToString(diferencia)}
                </span>
              </div>
            )}

            <div>
              <FieldLabel>Observación (opcional)</FieldLabel>
              <Input
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                placeholder="Justificación si hay diferencia"
                className="h-11 rounded-md"
              />
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
