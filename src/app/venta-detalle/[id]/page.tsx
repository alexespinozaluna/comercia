"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { Documento, toDisplayDocumento, DocumentoDisplay } from "@/types/database";
import { apiGet, apiDelete } from "@/lib/api-client";
import { useResource } from "@/hooks/use-resource";
import { numToString, fechaCortaHora, cantidadString } from "@/lib/format";
import { TipoDoc, esEgreso, esAbono, NOMBRE_TIPO_DOC } from "@/lib/tipo-documento";
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
import { Share2, Printer, Pencil, CreditCard, Trash2, MapPin, UserRound, CalendarDays, UserCheck, Package, Wallet, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { TicketShareSheet } from "@/components/ventas/ticket-share-sheet";
import { MetodoPagoCorrectorSheet } from "@/components/ventas/metodo-pago-corrector-sheet";
import { useAppStore } from "@/stores/app-store";
import { esSoloLectura } from "@/lib/permisos";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { cn } from "@/lib/utils";

export default function VentaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const { id } = use(params);
  const [shareOpen, setShareOpen] = useState(false);
  const [metodoOpen, setMetodoOpen] = useState(false);
  const soloLectura = esSoloLectura(useAppStore((s) => s.authUser)?.rol);

  const { data, loading, reload } = useResource(async () => {
    const [docData, caja] = await Promise.all([
      apiGet<Documento | null>(`/api/ventas/${id}`),
      apiGet<{ id: number } | null>("/api/caja").catch(() => null),
    ]);
    return {
      doc: docData ? toDisplayDocumento(docData) : null,
      cajaAbiertaId: caja?.id ?? null,
    };
  }, [id]);
  const doc: DocumentoDisplay | null = data?.doc ?? null;
  const cajaAbiertaId = data?.cajaAbiertaId ?? null;

  const handleDelete = async () => {
    if (!doc) return;
    // Abono (tipo 2) y pago con saldo a favor (tipo 6): borrado físico vía
    // /api/abonos para que la cascada + trigger restauren el Saldo de la deuda
    // (y del crédito tipo 4, en el caso del tipo 6). Venta/gasto: soft-delete.
    const esAbonoDoc = esAbono(doc.IdTipoDocumento);
    try {
      await apiDelete(esAbonoDoc ? `/api/abonos/${doc.id}` : `/api/ventas/${doc.id}`);
      useAppStore.getState().triggerRefresh();
      toast.success(esAbonoDoc ? "Abono eliminado" : "Documento eliminado");
      router.push("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  if (loading) return <LoadingState variant="skeleton-detail" count={5} />;
  if (!doc) return <EmptyState title="Documento no encontrado" description="El documento solicitado no existe o fue eliminado." />;

  const isGasto = esEgreso(doc.IdTipoDocumento);
  const isAbono = doc.IdTipoDocumento === TipoDoc.ABONO;
  const isSaldoFavor = doc.IdTipoDocumento === TipoDoc.SALDO_FAVOR;
  const isPagoFavor = doc.IdTipoDocumento === TipoDoc.ABONO_FAVOR; // abono con saldo a favor
  const isAjuste = doc.IdTipoDocumento === TipoDoc.AJUSTE; // Baja/Inventario → se gestiona en Stock
  // Regla genérica: un movimiento solo se edita/elimina mientras su caja siga
  // abierta (mismo día/sesión). El tipo 6 no tiene caja (IdCaja null) → exento.
  const cajaOk = doc.IdCaja == null || (cajaAbiertaId != null && cajaAbiertaId === doc.IdCaja);
  // Saldo a favor (4) y pago con saldo a favor (6) no se editan por el form de venta.
  // Los ajustes (5) se gestionan solo desde Stock → Ajustes, no aquí.
  // SUPERVISOR es solo lectura: sin editar/eliminar/abonar.
  const canEdit = !soloLectura && doc.TotalAbono === 0 && !isSaldoFavor && !isPagoFavor && !isAjuste && cajaOk;
  // Abono (tipo 2): solo se edita si cubre UNA sola deuda (1 item). El abono
  // multi-detalle (varias deudas) no se edita — solo se elimina. La edición va
  // por el form /venta-abono (idAbono), no por el form de venta.
  const canEditAbono = !soloLectura && isAbono && (doc.DocumentoItem?.length ?? 0) === 1 && cajaOk;
  // El pago con saldo a favor SÍ se puede eliminar (= anular): el trigger
  // restaura la deuda y el crédito. El resto, solo con su caja abierta.
  const canDelete = soloLectura
    ? false
    : isPagoFavor
    ? true
    : doc.TotalAbono === 0 && !isSaldoFavor && !isAjuste && cajaOk;
  const canAbono = !soloLectura && doc.bCredito && doc.Saldo > 0;
  // Corregir método de pago: docs con método real (no crédito, no tipo 5/6),
  // solo con su caja abierta. La validación se repite en el backend.
  const canCorregirMetodo = !soloLectura && !doc.bCredito && !isPagoFavor && !isAjuste && cajaOk;

  return (
    <div className="space-y-2 max-w-lg mx-auto">
      <PageHeader
        title={`${NOMBRE_TIPO_DOC[doc.IdTipoDocumento] ?? "Documento"} #${doc.NroVenta}`}
        onBack={() => router.back()}
      />

      {/* Resumen card */}
      <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-3 space-y-3">
        {/* Header: solo el concepto/descripción */}
        <p className="text-sm font-semibold truncate">
          {doc.Concepto ?? doc.Descripcion ?? `${NOMBRE_TIPO_DOC[doc.IdTipoDocumento] ?? "Documento"} #${doc.NroVenta}`}
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
              <CreditCard className="h-3.5 w-3.5" /> Forma de Venta
            </span>
            <StatusBadge variant={doc.bCredito ? "info" : "success"}>{doc.FormaVenta}</StatusBadge>
          </div>

          {/* Método de pago — cuando el documento lo registra; corregible si aplica */}
          {(doc.MetodoPago?.Nombre || canCorregirMetodo) && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" /> Método de pago
              </span>
              <span className="font-medium flex items-center gap-2">
                {doc.MetodoPago?.Nombre ?? "Sin método"}
                {canCorregirMetodo && (
                  <button
                    type="button"
                    onClick={() => setMetodoOpen(true)}
                    aria-label="Corregir método de pago"
                    className="text-brand hover:text-brand-dark transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            </div>
          )}

          {/* Montos: pagado → Total; deuda → Abonado (si hay) + Saldo */}
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
          {/* Header — en abonos, cada ítem referencia una venta cubierta */}
          <div className="px-4 py-2 border-b border-border bg-muted/40">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {isAbono ? "Deudas cubiertas" : "Productos"}
            </span>
          </div>
          {/* Rows */}
          <div className="divide-y divide-border">
            {doc.DocumentoItem.map((item) => {
              // En un abono, el ítem apunta a la venta pagada (IdDocumentoRef):
              // la fila navega a su detalle y omite el ruido de und/precio.
              const refId = item.IdDocumentoRef ?? 0;
              const clickable = isAbono && refId > 0;
              const detalle = (
                <>
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
                    {!isAbono && (
                      <div className="mt-0.5 text-xs text-muted-foreground flex items-center gap-3">
                        <span className="tabular-nums">{cantidadString(item.Cantidad)} und</span>
                        <span>Precio U. <span className="tabular-nums">{numToString(item.PrecioVenta)}</span></span>
                      </div>
                    )}
                  </div>
                  {clickable && <ChevronRight className="h-4 w-4 text-muted-foreground self-center shrink-0" />}
                </>
              );
              return clickable ? (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => router.push(`/venta-detalle/${refId}`)}
                  className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-accent/30 transition-colors"
                  aria-label={`Ver detalle de la venta referenciada`}
                >
                  {detalle}
                </button>
              ) : (
                <div key={item.id} className="flex items-start gap-3 px-4 py-2.5">
                  {detalle}
                </div>
              );
            })}
          </div>
          {/* Subtotal / Descuento — solo si hubo descuento */}
          {doc.Descuento > 0 && (
            <div className="px-4 pt-3 space-y-1 text-sm border-t border-border bg-muted/20">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{numToString(doc.Importe)}</span>
              </div>
              <div className="flex justify-between text-success">
                <span>Descuento</span>
                <span className="tabular-nums">−{numToString(doc.Descuento)}</span>
              </div>
            </div>
          )}
          {/* Total row */}
          <div
            className={cn(
              "flex justify-between items-center px-4 py-3 bg-muted/20",
              doc.Descuento > 0 ? "pt-1" : "border-t border-border",
            )}
          >
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
            onClick={() =>
              router.push(
                isGasto
                  ? `/venta-gasto?id=${doc.id}`
                  : isDesktop
                  ? `/venta-form/${doc.id}`
                  : `/venta/editar-movil/${doc.id}`,
              )
            }
            aria-label="Editar documento"
          >
            <Pencil className="h-4 w-4" /> Editar
          </Button>
        )}
        {canEditAbono && (
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
      <MetodoPagoCorrectorSheet
        docId={doc.id}
        currentMetodoId={doc.IdMetodoPago}
        open={metodoOpen}
        onOpenChange={setMetodoOpen}
        onCorrected={reload}
      />
    </div>
  );
}
