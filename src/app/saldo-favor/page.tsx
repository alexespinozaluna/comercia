"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Cliente, MetodoPago } from "@/types/database";
import { apiGet, apiPost } from "@/lib/api-client";
import { numToString, extraerIniciales, toInputDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { ClienteSelectorSheet } from "@/components/ventas/cliente-selector-sheet";
import { toast } from "sonner";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";
import { PiggyBank, UserPlus, X } from "lucide-react";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
      {children}
    </label>
  );
}

export default function SaldoFavorPage() {
  const router = useRouter();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [fecha, setFecha] = useState(toInputDate());
  const [monto, setMonto] = useState(0);
  const [concepto, setConcepto] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago[]>([]);
  const [selectedMetodo, setSelectedMetodo] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const methods = await apiGet<MetodoPago[]>("/api/metodo-pago");
        setMetodoPago(methods);
        const efectivo = methods.find((m) => m.bEfectivo) ?? methods[0];
        if (efectivo) setSelectedMetodo(efectivo.id);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    if (!cliente) { toast.error("Seleccione un cliente"); return; }
    if (monto <= 0) { toast.error("Ingrese un monto"); return; }
    setSaving(true);
    try {
      await apiPost("/api/saldo-favor", {
        IdCliente: cliente.id,
        FechaEmision: fecha,
        Concepto: concepto || null,
        Total: monto,
        IdMetodoPago: selectedMetodo,
      });
      useAppStore.getState().triggerRefresh();
      toast.success(`Saldo a favor registrado · ${numToString(monto)}`);
      router.push("/");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Error al registrar saldo a favor");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState variant="skeleton-form" count={3} />;

  return (
    <div className="space-y-2 max-w-lg">
      <PageHeader title="Saldo a favor" onBack={() => router.back()} />

      {/* Cliente */}
      <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-3">
        <FieldLabel>Cliente *</FieldLabel>
        {cliente ? (
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-full bg-brand-surface flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-brand-dark">{extraerIniciales(cliente.Nombre)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{cliente.Nombre}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="text-xs font-semibold text-brand hover:text-brand-dark transition-colors"
              >
                Cambiar
              </button>
              <button
                type="button"
                onClick={() => setCliente(null)}
                aria-label="Quitar cliente"
                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="w-full flex items-center gap-2.5 rounded-md ring-1 ring-border/50 bg-white dark:bg-card px-3 py-2.5 text-left hover:bg-accent transition-colors"
          >
            <div className="h-9 w-9 rounded-full bg-brand-surface flex items-center justify-center shrink-0">
              <UserPlus className="h-4 w-4 text-brand" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Seleccionar cliente</span>
          </button>
        )}
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-3 space-y-2">
        {/* Monto */}
        <div>
          <FieldLabel>Monto a favor *</FieldLabel>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium pointer-events-none">$</span>
            <Input
              type="number"
              value={monto || ""}
              onChange={(e) => setMonto(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="h-11 rounded-md pl-7 text-[18px] font-bold text-brand-dark"
            />
          </div>
          {monto > 0 && (
            <p className="text-sm font-semibold mt-1 text-success">{numToString(monto)}</p>
          )}
        </div>

        {/* Concepto */}
        <div>
          <FieldLabel>Concepto</FieldLabel>
          <Input
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder="Saldo a favor"
            className="h-11 rounded-md"
          />
        </div>

        {/* Fecha */}
        <div>
          <FieldLabel>Fecha</FieldLabel>
          <Input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="h-11 rounded-md"
          />
        </div>

        {/* Método de pago — pills */}
        {metodoPago.length > 0 && (
          <div>
            <FieldLabel>Método de pago</FieldLabel>
            <div className="flex gap-2 flex-wrap">
              {metodoPago.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMetodo(m.id)}
                  className={cn(
                    "text-sm px-4 py-2 rounded-lg font-medium transition-colors",
                    selectedMetodo === m.id
                      ? "bg-brand-surface text-brand-dark ring-1 ring-brand/30"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  )}
                >
                  {m.Nombre}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <Button
        className="w-full h-12 bg-brand hover:bg-brand-dark text-white font-bold text-base gap-2"
        onClick={handleSave}
        disabled={!cliente || monto <= 0 || saving}
      >
        <PiggyBank className="h-5 w-5" />
        {saving ? "Guardando..." : "Registrar saldo a favor"}
      </Button>

      <ClienteSelectorSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSelect={(c) => setCliente(c)}
      />
    </div>
  );
}
