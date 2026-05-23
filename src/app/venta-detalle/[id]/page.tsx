"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Documento, toDisplayDocumento, DocumentoDisplay } from "@/types/database";
import { apiGet, apiDelete } from "@/lib/api-client";
import { numToString, fechaString, extraerIniciales } from "@/lib/format";
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
import { Share2, Printer, Pencil, CreditCard, Trash2, Receipt, MapPin, UserRound, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

export default function VentaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentoDisplay | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then(async (p) => {
      try {
        const data = await apiGet<Documento | null>(`/api/ventas/${p.id}`);
        if (data) setDoc(toDisplayDocumento(data));
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
    try {
      await apiDelete(`/api/ventas/${doc.id}`);
      useAppStore.getState().triggerRefresh();
      toast.success("Documento eliminado");
      router.push("/");
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const handleShare = async () => {
    if (!doc) return;
    try {
      const text = await apiGet<string>(`/api/ticket/${doc.id}?width=384`);
      const canvas = document.createElement("canvas");
      canvas.width = 384;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const lines = text.split("\n");
      canvas.height = lines.length * 16 + 32;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = "12px monospace";
      ctx.fillStyle = "black";
      lines.forEach((line: string, i: number) => {
        ctx.fillText(line, 8, 20 + i * 16);
      });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        if (navigator.share) {
          const file = new File([blob], `ticket-${doc.id}.png`, { type: "image/png" });
          await navigator.share({ files: [file], title: `Ticket ${doc.NroVenta}` });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `ticket-${doc.id}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }, "image/png");
    } catch {
      toast.error("Error al generar ticket");
    }
  };

  if (loading) return <LoadingState variant="skeleton-detail" count={5} />;
  if (!doc) return <EmptyState title="Documento no encontrado" description="El documento solicitado no existe o fue eliminado." />;

  const isGasto = doc.IdTipoDocumento === 3;
  const isAbono = doc.IdTipoDocumento === 2;
  const canEdit = doc.TotalAbono === 0;
  const canAbono = doc.bCredito && doc.Saldo > 0;

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <PageHeader
        title={`Venta #${doc.NroVenta}`}
        backHref="/venta"
      />

      {/* Resumen card */}
      <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold",
            isGasto ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
          )}>
            {doc.Cliente ? extraerIniciales(doc.Cliente.Nombre) : <Receipt className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">
              {doc.Concepto ?? doc.Descripcion ?? `Venta #${doc.NroVenta}`}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge variant={doc.bCredito ? "info" : "success"}>{doc.FormaVenta}</StatusBadge>
            </div>
          </div>
          <div className={cn("text-lg font-extrabold shrink-0", isGasto ? "text-destructive" : "text-success")}>
            {numToString(doc.Total)}
          </div>
        </div>

        <Separator />

        {/* Detail rows */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> Fecha
            </span>
            <span className="font-medium">{fechaString(new Date(doc.FechaEmision))}</span>
          </div>
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
        </div>
      </div>

      {/* Items */}
      {doc.DocumentoItem && doc.DocumentoItem.length > 0 && (
        <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2 border-b border-border bg-muted/40">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Producto</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-center w-10">Cant.</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-right w-20">Precio</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-right w-20">Total</span>
          </div>
          {/* Rows */}
          <div className="divide-y divide-border">
            {doc.DocumentoItem.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2.5 text-sm items-center">
                <span className="font-medium truncate">{item.Descripcion}</span>
                <span className="text-center text-muted-foreground w-10">{item.Cantidad}</span>
                <span className="text-right text-muted-foreground w-20">{numToString(item.PrecioVenta)}</span>
                <span className="text-right font-semibold w-20">{numToString(item.Total)}</span>
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
          onClick={handleShare}
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
        {canEdit && (
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
    </div>
  );
}
