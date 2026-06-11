"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MetodoPago, Documento } from "@/types/database";
import { apiGet, apiPost, apiPut } from "@/lib/api-client";
import { toInputDate } from "@/lib/format";
import { TipoDoc } from "@/lib/tipo-documento";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { toast } from "sonner";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
      {children}
    </label>
  );
}

function VentaGastoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = parseInt(searchParams.get("id") ?? "0");
  const urlRef = searchParams.get("UrlRef") ?? "/";
  const isEdit = id > 0;

  const [fecha, setFecha] = useState(toInputDate());
  const [valor, setValor] = useState(0);
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
        if (methods.length > 0) setSelectedMetodo(methods[0].id);
        if (isEdit) {
          const data = await apiGet<Documento | null>(`/api/ventas/${id}`);
          if (data) {
            setFecha(data.FechaEmision?.split("T")[0] ?? toInputDate());
            setValor(data.Total);
            setConcepto(data.Concepto ?? data.Descripcion ?? "");
            setSelectedMetodo(data.IdMetodoPago);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, isEdit]);

  const handleSave = async () => {
    if (saving) return;
    if (valor <= 0) { toast.error("Ingrese un valor"); return; }
    if (!concepto) { toast.error("Ingrese un concepto"); return; }
    setSaving(true);
    try {
      const gastoData = {
        FechaEmision: fecha,
        Descripcion: concepto,
        Concepto: concepto,
        Total: valor,
        bCredito: false,
        IdCliente: null,
        IdClienteDireccion: null,
        DireccionEntrega: null,
        TotalAbono: 0,
        IdTipoDocumento: TipoDoc.GASTO,
        Saldo: 0,
        IdMetodoPago: selectedMetodo,
      };
      if (isEdit) {
        await apiPut(`/api/gastos/${id}`, gastoData);
        toast.success("Gasto actualizado");
      } else {
        await apiPost("/api/gastos", gastoData);
        toast.success("Gasto registrado");
      }
      useAppStore.getState().triggerRefresh();
      router.push(urlRef);
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar gasto");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState variant="skeleton-form" count={3} />;

  return (
    <div className="space-y-2 max-w-lg">
      <PageHeader
        title={isEdit ? "Editar gasto" : "Registrar gasto"}
        onBack={() => router.back()}
      />

      <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-3 space-y-2">
        {/* Concepto */}
        <div>
          <FieldLabel>Descripción del gasto *</FieldLabel>
          <Textarea
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder="Descripción del gasto"
            rows={3}
            className="rounded-md resize-none"
          />
        </div>

        {/* Monto */}
        <div>
          <FieldLabel>Monto *</FieldLabel>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium pointer-events-none">$</span>
            <Input
              type="number"
              value={valor || ""}
              onChange={(e) => setValor(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="h-11 rounded-md pl-7 font-semibold"
            />
          </div>
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
        className="w-full h-12 bg-brand hover:bg-brand-dark text-white font-bold text-base"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "Guardando..." : isEdit ? "Actualizar gasto" : "Guardar gasto"}
      </Button>
    </div>
  );
}

export default function VentaGastoPage() {
  return (
    <Suspense fallback={<LoadingState variant="skeleton-form" count={3} />}>
      <VentaGastoContent />
    </Suspense>
  );
}
