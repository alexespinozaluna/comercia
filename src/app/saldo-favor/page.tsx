"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Cliente, MetodoPago, SaldoFavorRow, Caja } from "@/types/database";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
import { numToString, extraerIniciales, fechaString, toInputDate, parseDateOnly } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { MontoInput } from "@/components/shared/monto-input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ClienteSelectorSheet } from "@/components/ventas/cliente-selector-sheet";
import { toast } from "sonner";
import { useAppStore } from "@/stores/app-store";
import { esSoloLectura } from "@/lib/permisos";
import { useGuardar } from "@/hooks/use-guardar";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/utils";
import { PiggyBank, Plus, UserPlus, X, Pencil, Trash2 } from "lucide-react";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
      {children}
    </label>
  );
}

export default function SaldoFavorPage() {
  const router = useRouter();
  const soloLectura = esSoloLectura(useAppStore((s) => s.authUser)?.rol);

  const { data, loading, reload } = useResource(async () => {
    const [rows, cajaAct, methods] = await Promise.all([
      apiGet<SaldoFavorRow[]>("/api/saldo-favor"),
      apiGet<Caja | null>("/api/caja").catch(() => null),
      apiGet<MetodoPago[]>("/api/metodo-pago").catch(() => [] as MetodoPago[]),
    ]);
    return { rows, cajaAct, methods };
  });
  const lista = data?.rows ?? [];
  const caja = data?.cajaAct ?? null;
  const metodoPago = data?.methods ?? [];

  // Crear (sheet)
  const [createOpen, setCreateOpen] = useState(false);
  const [clienteSheetOpen, setClienteSheetOpen] = useState(false);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [fecha, setFecha] = useState(toInputDate());
  const [monto, setMonto] = useState(0);
  const [concepto, setConcepto] = useState("");
  const [selectedMetodo, setSelectedMetodo] = useState<number | null>(null);
  const { saving, guardar } = useGuardar();

  // Método por defecto (efectivo) cuando llegan los métodos de pago.
  useEffect(() => {
    const methods = data?.methods;
    if (!methods?.length || selectedMetodo != null) return;
    const efectivo = methods.find((m) => m.bEfectivo) ?? methods[0];
    setSelectedMetodo(efectivo?.id ?? null);
  }, [data, selectedMetodo]);

  // Editar (sheet) / eliminar
  const [editTarget, setEditTarget] = useState<SaldoFavorRow | null>(null);
  const [editMonto, setEditMonto] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<SaldoFavorRow | null>(null);

  // ¿Se puede editar/eliminar? No usado + su caja sigue abierta (la actual).
  const esEditable = (row: SaldoFavorRow) =>
    caja != null && row.IdCaja === caja.id && Math.abs(row.Total - row.Saldo) < 0.01;

  const motivoBloqueo = (row: SaldoFavorRow) => {
    if (Math.abs(row.Total - row.Saldo) >= 0.01) return "Utilizado";
    return "Caja cerrada";
  };

  const resetCreate = () => {
    setCliente(null);
    setMonto(0);
    setConcepto("");
    setFecha(toInputDate());
  };

  const handleCreate = () => guardar(async () => {
    if (!cliente) { toast.error("Seleccione un cliente"); return; }
    if (monto <= 0) { toast.error("Ingrese un monto"); return; }
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
      setCreateOpen(false);
      resetCreate();
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrar");
    }
  });

  const handleEdit = () => guardar(async () => {
    if (!editTarget) return;
    if (editMonto <= 0) { toast.error("Ingrese un monto"); return; }
    try {
      await apiPut(`/api/saldo-favor/${editTarget.id}`, { Total: editMonto });
      useAppStore.getState().triggerRefresh();
      toast.success("Saldo a favor actualizado");
      setEditTarget(null);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al editar");
    }
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiDelete(`/api/saldo-favor/${deleteTarget.id}`);
      useAppStore.getState().triggerRefresh();
      toast.success("Saldo a favor eliminado");
      setDeleteTarget(null);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  if (loading) return <LoadingState variant="skeleton-list" count={4} />;

  return (
    <div className="space-y-2">
      <PageHeader
        title="Saldo a favor"
        onBack={() => router.back()}
        actions={
          soloLectura ? undefined : (
            <Button
              size="sm"
              className="bg-brand hover:bg-brand-dark text-white gap-1.5 shadow-sm"
              onClick={() => { resetCreate(); setCreateOpen(true); }}
            >
              <Plus className="h-4 w-4" />
              Crear
            </Button>
          )
        }
      />

      {lista.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="Sin saldos a favor"
          description="No hay clientes con saldo a favor."
        />
      ) : (
        <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 divide-y divide-border overflow-hidden">
          {lista.map((row) => {
            const editable = esEditable(row) && !soloLectura;
            const usado = row.Total - row.Saldo;
            return (
              <div key={row.id} className="flex items-center gap-2 p-3">
                <div className="h-10 w-10 rounded-full bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-violet-700 dark:text-violet-400">
                    {extraerIniciales(row.Cliente?.Nombre ?? "?")}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{row.Cliente?.Nombre ?? "Sin cliente"}</div>
                  <div className="text-xs text-muted-foreground">
                    {fechaString(parseDateOnly(row.FechaEmision))}
                    {usado >= 0.01 && <span> · usado {numToString(usado)}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[15px] font-extrabold text-violet-700 dark:text-violet-400 tabular-nums">
                    {numToString(row.Saldo)}
                  </div>
                </div>
                {editable ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      aria-label="Editar"
                      onClick={() => { setEditTarget(row); setEditMonto(row.Total); }}
                      className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-brand hover:bg-brand-surface/60 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Eliminar"
                      onClick={() => setDeleteTarget(row)}
                      className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">
                    {motivoBloqueo(row)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sheet — Crear */}
      <Sheet open={createOpen} onOpenChange={(v) => { if (!v) resetCreate(); setCreateOpen(v); }}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[88vh] overflow-y-auto">
          <SheetHeader className="pb-1">
            <SheetTitle>Nuevo saldo a favor</SheetTitle>
            <SheetDescription className="text-xs">Registra un anticipo / crédito del cliente</SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-4 space-y-3">
            {/* Cliente */}
            <div>
              <FieldLabel>Cliente *</FieldLabel>
              {cliente ? (
                <div className="flex items-center gap-2.5 rounded-md ring-1 ring-border/50 p-2.5">
                  <div className="h-9 w-9 rounded-full bg-brand-surface flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-brand-dark">{extraerIniciales(cliente.Nombre)}</span>
                  </div>
                  <span className="flex-1 min-w-0 text-sm font-semibold truncate">{cliente.Nombre}</span>
                  <button type="button" onClick={() => setClienteSheetOpen(true)} className="text-xs font-semibold text-brand">Cambiar</button>
                  <button type="button" onClick={() => setCliente(null)} aria-label="Quitar" className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setClienteSheetOpen(true)}
                  className="w-full flex items-center gap-2.5 rounded-md ring-1 ring-border/50 px-3 py-2.5 text-left hover:bg-accent transition-colors"
                >
                  <div className="h-9 w-9 rounded-full bg-brand-surface flex items-center justify-center shrink-0"><UserPlus className="h-4 w-4 text-brand" /></div>
                  <span className="text-sm font-medium text-muted-foreground">Seleccionar cliente</span>
                </button>
              )}
            </div>

            <div>
              <FieldLabel>Monto a favor *</FieldLabel>
              <MontoInput value={monto} onChange={setMonto} className="h-11 rounded-md text-[18px] font-bold text-brand-dark" />
              {monto > 0 && (
                <p className="text-sm font-semibold mt-1 text-success">{numToString(monto)}</p>
              )}
            </div>

            <div>
              <FieldLabel>Concepto</FieldLabel>
              <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Saldo a favor" className="h-11 rounded-md" />
            </div>

            <div>
              <FieldLabel>Fecha</FieldLabel>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-11 rounded-md" />
            </div>

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
                        selectedMetodo === m.id ? "bg-brand-surface text-brand-dark ring-1 ring-brand/30" : "bg-muted/60 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {m.Nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              className="w-full h-11 bg-brand hover:bg-brand-dark text-white font-semibold gap-2"
              onClick={handleCreate}
              disabled={!cliente || monto <= 0 || saving}
            >
              <PiggyBank className="h-5 w-5" />
              {saving ? "Guardando..." : "Registrar saldo a favor"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ClienteSelectorSheet open={clienteSheetOpen} onOpenChange={setClienteSheetOpen} onSelect={(c) => setCliente(c)} />

      {/* Sheet — Editar monto */}
      <Sheet open={editTarget != null} onOpenChange={(v) => { if (!v) setEditTarget(null); }}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="pb-1">
            <SheetTitle>Editar saldo a favor</SheetTitle>
            <SheetDescription className="text-xs">{editTarget?.Cliente?.Nombre} — solo se puede cambiar el monto</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4 space-y-3">
            <div>
              <FieldLabel>Monto *</FieldLabel>
              <MontoInput value={editMonto} onChange={setEditMonto} className="h-11 rounded-md text-[18px] font-bold text-brand-dark" />
              {editMonto > 0 && (
                <p className="text-sm font-semibold mt-1 text-success">{numToString(editMonto)}</p>
              )}
            </div>
            <Button className="w-full h-11 bg-brand hover:bg-brand-dark text-white font-semibold" onClick={handleEdit} disabled={editMonto <= 0 || saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Eliminar */}
      <AlertDialog open={deleteTarget != null} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar saldo a favor?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el saldo a favor de {deleteTarget?.Cliente?.Nombre} por {deleteTarget ? numToString(deleteTarget.Saldo) : ""}. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
