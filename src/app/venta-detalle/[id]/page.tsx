"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Documento, toDisplayDocumento, DocumentoDisplay } from "@/types/database";
import { apiGet, apiDelete } from "@/lib/api-client";
import { numToString, fechaCortaHora, cantidadString } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Share2, Printer, Pencil, CreditCard, Trash2, MapPin, UserRound, CalendarDays, UserCheck, Package } from "lucide-react";
import { toast } from "sonner";
import { TicketShareSheet } from "@/components/ventas/ticket-share-sheet";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

export default function VentaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentoDisplay | null>(null);
  const [cajaAbiertaId, setCajaAbiertaId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    params.then(async (p) => {
      try {
        const [data, caja] = await Promise.all([
          apiGet<Documento | null>(`/api/ventas/${p.id}`),
          apiGet<{ id: number } | null>("/api/caja").catch(() => null),
        ]);
        if (data) setDoc(toDisplayDocumento(data));
        setCajaAbiertaId(caja?.id ?? null);
      } catch (err) {
        console.error(err);
        toast.error("Error al cargar documento");
      } finally {
        setLoading(false);
      }
    });
  }, [params]);

  const handleDelete = async () => {
    if (!doc) return;
    // Abono (tipo 2) y pago con saldo a favor (tipo 6): borrado físico vía
    // /api/abonos para que la cascada + trigger restauren el Saldo de la deuda
    // (y del crédito tipo 4, en el caso del tipo 6). Venta/gasto: soft-delete.
    const esAbono = doc.IdTipoDocumento === 2 || doc.IdTipoDocumento === 6;
    try {
      await apiDelete(esAbono ? `/api/abonos/${doc.id}` : `/api/ventas/${doc.id}`);
      useAppStore.getState().triggerRefresh();
      toast.success(esAbono ? "Abono eliminado" : "Documento eliminado");
      router.push("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  if (loading) return <LoadingState variant="skeleton-detail" count={5} />;
  if (!doc) return <EmptyState title="Documento no encontrado" description="El documento solicitado no existe o fue eliminado." />;

  const isGasto = doc.IdTipoDocumento === 3;
  const isAbono = doc.IdTipoDocumento === 2;
  const isSaldoFavor = doc.IdTipoDocumento === 4;
  const isPagoFavor = doc.IdTipoDocumento === 6; // abono con saldo a favor
  // Regla genérica: un movimiento solo se edita/elimina mientras su caja siga
  // abierta (mismo día/sesión). El tipo 6 no tiene caja (IdCaja null) → exento.
  const cajaOk = doc.IdCaja == null || (cajaAbiertaId != null && cajaAbiertaId === doc.IdCaja);
  // Saldo a favor (4) y pago con saldo a favor (6) no se editan por el form de venta.
  const canEdit = doc.TotalAbono === 0 && !isSaldoFavor && !isPagoFavor && cajaOk;
  // El pago con saldo a favor SÍ se puede eliminar (= anular): el trigger
  // restaura la deuda y el crédito. El resto, solo con su caja abierta.
  const canDelete = isPagoFavor
    ? true
    : doc.TotalAbono === 0 && !isSaldoFavor && cajaOk;
  const canAbono = doc.bCredito && doc.Saldo > 0;

  return (
    <div className="space-y-2 max-w-lg mx-auto">
      <PageHeader
        title={`Venta #${doc.NroVenta}`}
        onBack={() => router.back()}
      />

      {/* Resumen card */}
      <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-3 space-y-3">
        {/* Header: solo el concepto/descripción */}
        <p className="text-sm font-semibold truncate">
          {doc.Concepto ?? doc.Descripcion ?? `Venta #${doc.NroVenta}`}
        </p>

        <Separator />

        {/* Detail rows */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> Fecha
            </span>
            <span className="font-medium">
              {fechaCortaHora(doc.FechaEmision, doc.FechaCreacion)}
            </span>
          </div>

          {doc.UsuarioCreacion?.Nombre && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5" /> Creada por
              </span>
              <span className="font-medium truncate max-w-[55%] text-right">
                {doc.UsuarioCreacion.Nombre}
              </span>
            </div>
          )}

          {doc.Cliente && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5" /> Cliente
              </span>
              <span className="font-medium">{doc.Cliente.Nombre}</span>
            </div>
          )}

          {doc.DireccionEntrega && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Dirección
              </span>
              <span className="font-medium truncate max-w-[55%] text-right">{doc.DireccionEntrega}</span>
            </div>
          )}

          {/* Forma de pago — antes era un badge en el header */}
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" /> Forma pago
            </span>
            <StatusBadge variant={doc.bCredito ? "info" : "success"}>{doc.FormaVenta}</StatusBadge>
          </div>

          {/* Montos: contado → Total; crédito → Abonado (si hay) + Saldo */}
          {doc.bCredito && doc.TotalAbono > 0 && (
            <div className="flex justify-between items-center text-success">
              <span className="font-medium">Abonado</span>
              <span className="font-semibold">{numToString(doc.TotalAbono)}</span>
            </div>
          )}
          {doc.bCredito && doc.Saldo > 0 && (
            <div className="flex justify-between items-center">
              <span className="font-semibold text-destructive">Saldo pendiente</span>
              <span className="font-bold text-destructive">{numToString(doc.Saldo)}</span>
            </div>
          )}
          {!doc.bCredito && (
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total</span>
              <span className={cn("font-bold", isGasto ? "text-destructive" : "text-success")}>
                {numToString(doc.Total)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Items */}
      {doc.DocumentoItem && doc.DocumentoItem.length > 0 && (
        <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-2 border-b border-border bg-muted/40">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Productos</span>
          </div>
          {/* Rows */}
          <div className="divide-y divide-border">
            {doc.DocumentoItem.map((item) => (
              <div key={item.id} className="flex items-start gap-3 px-4 py-2.5">
                {/* Avatar */}
                <div className="h-10 w-10 rounded-full bg-brand-surface flex items-center justify-center shrink-0">
                  <Package className="h-5 w-5 text-brand" />
                </div>
                {/* Detalle */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <span className="flex-1 text-sm font-medium text-foreground">{item.Descripcion}</span>
                    <span className="text-sm font-semibold tabular-nums shrink-0">{numToString(item.Total)}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground flex items-center gap-3">
                    <span className="tabular-nums">{cantidadString(item.Cantidad)} und</span>
                    <span>Precio U. <span className="tabular-nums">{numToString(item.PrecioVenta)}</span></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Total row */}
          <div className="flex justify-between items-center px-4 py-3 border-t border-border bg-muted/20">
            <span className="text-sm font-semibold">Total</span>
            <span className={cn("text-base font-extrabold", isGasto ? "text-destructive" : "text-success")}>
              {numToString(doc.Total)}
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-10"
          onClick={() => setShareOpen(true)}
          aria-label="Compartir ticket"
        >
          <Share2 className="h-4 w-4" /> Compartir
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-10"
          onClick={() => toast.info("Impresión Bluetooth no disponible en esta versión")}
          aria-label="Imprimir ticket"
        >
          <Printer className="h-4 w-4" /> Imprimir
        </Button>
        {canEdit && !isAbono && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-10"
            onClick={() => router.push(isGasto ? `/venta-gasto?id=${doc.id}` : `/venta-form/${doc.id}`)}
            aria-label="Editar documento"
          >
            <Pencil className="h-4 w-4" /> Editar
          </Button>
        )}
        {isAbono && cajaOk && doc.DocumentoItem?.length === 1 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-10"
            onClick={() => router.push(`/venta-abono?idAbono=${doc.id}`)}
            aria-label="Editar abono"
          >
            <Pencil className="h-4 w-4" /> Editar
          </Button>
        )}
        {canAbono && (
          <Button
            size="sm"
            className="gap-1.5 h-10 bg-brand hover:bg-brand-dark text-white"
            onClick={() => router.push(`/venta-abono?id=${doc.id}&tipo=1`)}
            aria-label="Registrar abono"
          >
            <CreditCard className="h-4 w-4" /> Abono
          </Button>
        )}
        {canDelete && (
          <AlertDialog>
            <AlertDialogTrigger
              className={cn(
                "col-span-2 inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors",
                "h-10 px-3 border border-destructive/20 text-destructive hover:bg-destructive/5"
              )}
            >
              <Trash2 className="h-4 w-4" /> Eliminar
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
                <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <TicketShareSheet doc={doc} open={shareOpen} onOpenChange={setShareOpen} />
    </div>
  );
}
