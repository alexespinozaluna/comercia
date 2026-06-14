"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Documento, MetodoPago } from "@/types/database";
import { apiGet, apiPost, apiPut } from "@/lib/api-client";
import { numToString, fechaString, extraerIniciales, toInputDate, parseDateOnly } from "@/lib/format";
import { useResource } from "@/hooks/use-resource";
import { Input } from "@/components/ui/input";
import { MontoInput } from "@/components/shared/monto-input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { toast } from "sonner";
import { useAppStore } from "@/stores/app-store";
import { useGuardar } from "@/hooks/use-guardar";
import { cn } from "@/lib/utils";
import { BookOpenText, CreditCard, ChevronDown } from "lucide-react";

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
  const idAbono = parseInt(searchParams.get("idAbono") ?? "0");
  const isEdit = idAbono > 0;
  const pagina = searchParams.get("pagina") ?? (isEdit ? `/venta-detalle/${idAbono}` : "/");

  const [fecha, setFecha] = useState(toInputDate());
  const [total, setTotal] = useState(0);
  const [concepto, setConcepto] = useState("");
  const [selectedMetodo, setSelectedMetodo] = useState<number | null>(null);
  const [deudasOpen, setDeudasOpen] = useState(false);
  const { saving: aplicandoFavor, guardar: guardarFavor } = useGuardar();
  const { saving, guardar } = useGuardar();

  type AbonoData =
    | { kind: "invalid"; message: string; redirect?: string }
    | {
        kind: "ok";
        methods: MetodoPago[];
        deudas: Documento[];
        disponibleFavor: number;
        // En edición: monto que este abono ya aportaba a la venta (se suma al disponible).
        extraDisponible: number;
        // Valores para poblar el formulario al editar (null en alta).
        edit: { total: number; concepto: string; fecha: string; metodo: number | null } | null;
      };

  const { data, loading } = useResource(async (): Promise<AbonoData> => {
    const methods = await apiGet<MetodoPago[]>("/api/metodo-pago");

    if (isEdit) {
      const abono = await apiGet<Documento | null>(`/api/ventas/${idAbono}`);
      const item = abono?.DocumentoItem?.[0];
      if (!abono || !item) return { kind: "invalid", message: "Abono no encontrado" };
      if ((abono.DocumentoItem?.length ?? 0) !== 1) {
        return {
          kind: "invalid",
          message: "Este abono no se puede editar (varias deudas)",
          redirect: `/venta-detalle/${idAbono}`,
        };
      }
      const venta = await apiGet<Documento | null>(`/api/ventas/${item.IdDocumentoRef}`);
      return {
        kind: "ok",
        methods,
        deudas: venta ? [venta] : [],
        disponibleFavor: 0,
        extraDisponible: item.MontoAbono,
        edit: {
          total: item.MontoAbono,
          concepto: abono.Concepto ?? "",
          fecha: abono.FechaEmision.split("T")[0],
          metodo: abono.IdMetodoPago ?? null,
        },
      };
    }

    // Alta: deudas según tipo (1 = una venta puntual, 2 = todas las del cliente).
    let deudasAlta: Documento[] = [];
    if (tipo === 1 && id > 0) {
      const doc = await apiGet<Documento | null>(`/api/ventas/${id}`);
      if (doc) deudasAlta = [doc];
    } else if (tipo === 2 && id > 0) {
      const docs = await apiGet<Documento[]>(`/api/ventas?bCredito=true&idCliente=${id}`);
      deudasAlta = docs.filter((d) => d.Saldo > 0);
    }

    // Saldo a favor disponible del cliente.
    let clientId = tipo === 2 ? id : 0;
    if (tipo === 1 && id > 0) {
      const doc = await apiGet<Documento | null>(`/api/ventas/${id}`).catch(() => null);
      clientId = doc?.IdCliente ?? 0;
    }
    let disponibleFavor = 0;
    if (clientId > 0) {
      const favores = await apiGet<{ IdCliente: number | null; Saldo: number }[]>(
        `/api/saldo-favor?idCliente=${clientId}`,
      ).catch(() => [] as { IdCliente: number | null; Saldo: number }[]);
      disponibleFavor = favores.reduce((s, f) => s + (f.Saldo || 0), 0);
    }

    return { kind: "ok", methods, deudas: deudasAlta, disponibleFavor, extraDisponible: 0, edit: null };
  }, [id, tipo, idAbono, isEdit]);

  const ok = data?.kind === "ok" ? data : null;
  const deudas = ok?.deudas ?? [];
  const metodoPago = ok?.methods ?? [];
  const disponibleFavor = ok?.disponibleFavor ?? 0;
  const extraDisponible = ok?.extraDisponible ?? 0;

  // Side-effects al llegar los datos: poblar el formulario, o avisar/redirigir si
  // el abono no es editable. Separado del fetch (que es puro) — ver useResource.
  useEffect(() => {
    if (!data) return;
    if (data.kind === "invalid") {
      toast.error(data.message);
      if (data.redirect) router.replace(data.redirect);
      return;
    }
    // Por defecto, el método marcado como efectivo (bEfectivo); si no hay, el primero.
    const efectivo = data.methods.find((m) => m.bEfectivo) ?? data.methods[0];
    if (efectivo) setSelectedMetodo(efectivo.id);
    if (data.edit) {
      setTotal(data.edit.total);
      setConcepto(data.edit.concepto);
      setFecha(data.edit.fecha);
      if (data.edit.metodo != null) setSelectedMetodo(data.edit.metodo);
    }
  }, [data, router]);

  const totalDeuda = deudas.reduce((sum, d) => sum + d.Saldo, 0) + extraDisponible;
  const clienteName = deudas[0]?.Cliente?.Nombre ?? "";

  const handleSave = () => guardar(async () => {
    if (total <= 0) { toast.error("Ingrese un monto"); return; }
    if (total > totalDeuda) { toast.error("El monto excede la deuda"); return; }
    try {
      if (isEdit) {
        await apiPut(`/api/abonos/${idAbono}`, {
          FechaEmision: fecha,
          Concepto: concepto || null,
          Total: total,
          IdMetodoPago: selectedMetodo,
        });
      } else {
        // La distribución FIFO entre deudas y la validación se hacen en el servidor.
        await apiPost("/api/abonos", {
          tipo,
          id,
          FechaEmision: fecha,
          Concepto: concepto || null,
          Total: total,
          IdMetodoPago: selectedMetodo,
        });
      }
      useAppStore.getState().triggerRefresh();
      toast.success(isEdit ? "Abono modificado" : "Abono registrado");
      router.push(pagina);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Error al guardar abono");
    }
  });

  const aplicarFavor = Math.min(disponibleFavor, totalDeuda);

  const handleUsarSaldoFavor = () => guardarFavor(async () => {
    if (aplicarFavor <= 0) return;
    try {
      await apiPost("/api/saldo-favor/aplicar", {
        tipo,
        id,
        FechaEmision: fecha,
        Concepto: concepto || null,
        Total: aplicarFavor,
      });
      useAppStore.getState().triggerRefresh();
      toast.success(`Saldo a favor aplicado · ${numToString(aplicarFavor)}`);
      router.push(pagina);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Error al aplicar saldo a favor");
    }
  });

  if (loading) return <LoadingState variant="skeleton-form" count={3} />;

  return (
    <div className="space-y-2 max-w-lg">
      <PageHeader title={isEdit ? "Editar abono" : "Registrar abono"} onBack={() => router.back()} />

      {/* Cliente card */}
      {clienteName && (
        <div className="flex items-center gap-2 bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-3">
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

      {/* Deudas — acordeón colapsable */}
      {tipo === 2 && deudas.length > 0 && (
        <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 overflow-hidden">
          <button
            type="button"
            onClick={() => setDeudasOpen((o) => !o)}
            aria-expanded={deudasOpen}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-accent/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <BookOpenText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs font-semibold">
                Detalle de deudas ({deudas.length})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-destructive">{numToString(totalDeuda)}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  deudasOpen && "rotate-180",
                )}
              />
            </div>
          </button>

          {deudasOpen && (
            <div className="divide-y divide-border border-t border-border">
              {deudas.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <BookOpenText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{d.Concepto ?? d.Descripcion ?? `Venta #${d.id}`}</p>
                      <p className="text-[11px] text-muted-foreground">{fechaString(parseDateOnly(d.FechaEmision))}</p>
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
        </div>
      )}

      {/* Saldo a favor disponible — botón para aplicarlo a la deuda */}
      {!isEdit && disponibleFavor > 0 && totalDeuda > 0 && (
        <div className="rounded-lg ring-1 ring-violet-200/70 dark:ring-violet-900/40 bg-violet-50 dark:bg-violet-950/20 p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-400">
              Saldo a favor disponible
            </p>
            <p className="text-base font-extrabold text-violet-700 dark:text-violet-300 tabular-nums">
              {numToString(disponibleFavor)}
            </p>
          </div>
          <Button
            type="button"
            onClick={handleUsarSaldoFavor}
            disabled={aplicandoFavor}
            className="h-10 bg-violet-600 hover:bg-violet-700 text-white shrink-0"
          >
            {aplicandoFavor ? "Aplicando..." : `Usar ${numToString(aplicarFavor)}`}
          </Button>
        </div>
      )}

      {/* Form card */}
      <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-3 space-y-2">
        {/* Monto */}
        <div>
          <FieldLabel>Monto a abonar *</FieldLabel>
          <MontoInput
            value={total}
            onChange={setTotal}
            className="h-11 rounded-md text-[18px] font-bold text-brand-dark"
          />
          {total > 0 && (
            <p className="text-sm font-semibold mt-1">{numToString(total)}</p>
          )}
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
        disabled={total <= 0 || total > totalDeuda || saving}
      >
        <CreditCard className="h-5 w-5" />
        {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Confirmar abono"}
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
