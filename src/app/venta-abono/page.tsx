"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Documento, DocumentoItem, MetodoPago } from "@/types/database";
import { apiGet, apiPost } from "@/lib/api-client";
import { numToString, fechaString, extraerIniciales } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";
import { BookOpenText, CreditCard } from "lucide-react";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
      {children}
    </label>
  );
}

function VentaAbonoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = parseInt(searchParams.get("id") ?? "0");
  const tipo = parseInt(searchParams.get("tipo") ?? "1");
  const pagina = searchParams.get("pagina") ?? "/";

  const [deudas, setDeudas] = useState<Documento[]>([]);
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [total, setTotal] = useState(0);
  const [concepto, setConcepto] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago[]>([]);
  const [selectedMetodo, setSelectedMetodo] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const methods = await apiGet<MetodoPago[]>("/api/metodo-pago");
        setMetodoPago(methods);
        if (methods.length > 0) setSelectedMetodo(methods[0].id);

        if (tipo === 1 && id > 0) {
          const doc = await apiGet<Documento | null>(`/api/ventas/${id}`);
          if (doc) setDeudas([doc]);
        } else if (tipo === 2 && id > 0) {
          const docs = await apiGet<Documento[]>(`/api/ventas?bCredito=true&idCliente=${id}`);
          setDeudas(docs.filter((d) => d.Saldo > 0));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, tipo]);

  const totalDeuda = deudas.reduce((sum, d) => sum + d.Saldo, 0);
  const clienteName = deudas[0]?.Cliente?.Nombre ?? "";

  const handleSave = async () => {
    if (total <= 0) { toast.error("Ingrese un monto"); return; }
    if (total > totalDeuda) { toast.error("El monto excede la deuda"); return; }
    try {
      let remaining = total;
      const items: DocumentoItem[] = [];
      for (const deuda of deudas) {
        if (remaining <= 0) break;
        const abono = Math.min(remaining, deuda.Saldo);
        items.push({
          id: 0,
          IdProducto: 0,
          Descripcion: deuda.Concepto ?? deuda.Descripcion ?? `Abono a ${deuda.id}`,
          Cantidad: 1,
          PrecioVenta: abono,
          MontoAbono: abono,
          Total: abono,
          IdDocumento: 0,
          IdDocumentoRef: deuda.id,
        });
        remaining -= abono;
      }
      const documento: Documento = {
        id: 0,
        Estado: 1,
        IdTenant: 0,
        FechaCreacion: new Date().toISOString(),
        FechaEmision: fecha,
        Descripcion: null,
        Concepto: concepto || "Abono",
        Total: total,
        bCredito: false,
        IdCliente: deudas[0]?.IdCliente ?? 0,
        IdClienteDireccion: null,
        DireccionEntrega: null,
        DocumentoItem: items,
        Cliente: undefined,
        TotalAbono: 0,
        IdTipoDocumento: 2,
        Saldo: 0,
        IdMetodoPago: selectedMetodo,
      };
      await apiPost("/api/abonos", documento);
      useAppStore.getState().triggerRefresh();
      toast.success("Abono registrado");
      router.push(pagina);
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar abono");
    }
  };

  if (loading) return <LoadingState variant="skeleton-form" count={3} />;

  return (
    <div className="space-y-4 max-w-lg">
      <PageHeader title="Registrar abono" onBack={() => router.back()} />

      {/* Cliente card */}
      {clienteName && (
        <div className="flex items-center gap-3 bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-3">
          <div className="h-10 w-10 rounded-full bg-brand-surface flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-brand-dark">{extraerIniciales(clienteName)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{clienteName}</p>
            <p className="text-xs text-muted-foreground">{deudas.length} deuda{deudas.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] text-muted-foreground">Total deuda</p>
            <p className="text-base font-extrabold text-destructive">{numToString(totalDeuda)}</p>
          </div>
        </div>
      )}

      {/* Deudas list */}
      {tipo === 2 && deudas.length > 0 && (
        <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 overflow-hidden divide-y divide-border">
          {deudas.map((d) => (
            <div key={d.id} className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <BookOpenText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{d.Concepto ?? d.Descripcion ?? `Venta #${d.id}`}</p>
                  <p className="text-[11px] text-muted-foreground">{fechaString(new Date(d.FechaEmision))}</p>
                </div>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="text-sm font-bold text-destructive">{numToString(d.Saldo)}</p>
                {d.Total > d.Saldo && (
                  <p className="text-[11px] text-muted-foreground line-through">{numToString(d.Total)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form card */}
      <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-4 space-y-4">
        {/* Monto */}
        <div>
          <FieldLabel>Monto a abonar *</FieldLabel>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium pointer-events-none">$</span>
            <Input
              type="number"
              value={total || ""}
              onChange={(e) => setTotal(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="h-11 rounded-md pl-7 text-[18px] font-bold text-brand-dark"
            />
          </div>
          {total > 0 && total <= totalDeuda && (
            <p className="text-xs text-muted-foreground mt-1">
              Saldo restante: <span className="font-semibold text-destructive">{numToString(totalDeuda - total)}</span>
            </p>
          )}
        </div>

        {/* Concepto */}
        <div>
          <FieldLabel>Concepto</FieldLabel>
          <Input
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder="Abono"
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
        disabled={total <= 0 || total > totalDeuda}
      >
        <CreditCard className="h-5 w-5" />
        Confirmar abono
      </Button>
    </div>
  );
}

export default function VentaAbonoPage() {
  return (
    <Suspense fallback={<LoadingState variant="skeleton-form" count={3} />}>
      <VentaAbonoContent />
    </Suspense>
  );
}
