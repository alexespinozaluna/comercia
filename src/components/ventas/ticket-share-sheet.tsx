"use client";

import { useEffect, useRef, useState } from "react";
import { DocumentoDisplay, Negocio } from "@/types/database";
import { apiGet } from "@/lib/api-client";
import { renderTicketCanvas, ticketToBlob, type TicketWidth } from "@/lib/ticket";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Share2, Download } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TicketShareSheetProps {
  doc: DocumentoDisplay | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TicketShareSheet({ doc, open, onOpenChange }: TicketShareSheetProps) {
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [width, setWidth] = useState<TicketWidth>(80);
  const [busy, setBusy] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Cargar el negocio del documento: /api/negocio devuelve la lista de
  // sucursales del tenant; se elige la que coincide con doc.IdNegocio.
  useEffect(() => {
    if (!open || !doc) return;
    apiGet<Negocio[]>("/api/negocio")
      .then((list) => {
        const arr = Array.isArray(list) ? list : [];
        setNegocio(arr.find((n) => n.id === doc.IdNegocio) ?? arr[0] ?? null);
      })
      .catch(() => setNegocio(null));
  }, [open, doc]);

  // Render de la vista previa cuando cambia el ancho o los datos.
  useEffect(() => {
    if (!open || !doc || !previewRef.current) return;
    const canvas = renderTicketCanvas({ doc, negocio, widthMm: width });
    canvas.style.width = "100%";
    canvas.style.maxWidth = width === 58 ? "240px" : "320px";
    canvas.style.height = "auto";
    canvas.className = "rounded-sm ring-1 ring-border shadow-sm bg-white";
    const host = previewRef.current;
    host.replaceChildren(canvas);
  }, [open, doc, negocio, width]);

  const getBlob = async () => {
    if (!doc) return null;
    return ticketToBlob(renderTicketCanvas({ doc, negocio, widthMm: width }));
  };

  const handleShare = async () => {
    if (!doc) return;
    setBusy(true);
    try {
      const blob = await getBlob();
      if (!blob) return;
      const file = new File([blob], `ticket-${doc.NroVenta}.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Ticket ${doc.NroVenta}` });
      } else {
        descargar(blob);
        toast.info("Compartir no disponible: se descargó el ticket");
      }
    } catch {
      /* el usuario canceló el share */
    } finally {
      setBusy(false);
    }
  };

  const descargar = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ticket-${doc?.NroVenta}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownload = async () => {
    const blob = await getBlob();
    if (blob) descargar(blob);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Compartir ticket</SheetTitle>
          <SheetDescription className="text-xs">Elige el ancho de impresora</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4 space-y-3">
          {/* Selector de ancho */}
          <div className="flex gap-2">
            {([80, 58] as TicketWidth[]).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWidth(w)}
                className={cn(
                  "flex-1 h-10 rounded-md text-sm font-semibold ring-1 transition-colors",
                  width === w
                    ? "bg-brand text-white ring-brand"
                    : "bg-white dark:bg-card text-foreground ring-border hover:bg-accent",
                )}
              >
                {w}mm{w === 80 ? " (por defecto)" : ""}
              </button>
            ))}
          </div>

          {/* Vista previa */}
          <div ref={previewRef} className="flex justify-center bg-muted/30 rounded-md py-4" />

          {/* Acciones */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="gap-1.5 h-11" onClick={handleDownload}>
              <Download className="h-4 w-4" /> Descargar
            </Button>
            <Button
              className="gap-1.5 h-11 bg-brand hover:bg-brand-dark text-white"
              onClick={handleShare}
              disabled={busy}
            >
              <Share2 className="h-4 w-4" /> {busy ? "..." : "Compartir"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
