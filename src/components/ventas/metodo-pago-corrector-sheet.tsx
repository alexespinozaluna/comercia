"use client";

import { useEffect, useState } from "react";
import { MetodoPago } from "@/types/database";
import { apiGet, apiPatch } from "@/lib/api-client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useGuardar } from "@/hooks/use-guardar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MetodoPagoCorrectorSheetProps {
  docId: number;
  /** Método actual del documento (para preseleccionar). */
  currentMetodoId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se llama tras corregir con éxito (para refrescar el detalle). */
  onCorrected: () => void;
}

/**
 * Selector para corregir el método de pago de un documento. Reutiliza los
 * métodos reales de `/api/metodo-pago` (ya excluye "Deuda") como pills y hace
 * PATCH a `/api/documentos/{id}/metodo-pago`. La validación (elegibilidad,
 * caja abierta) vive en el backend.
 */
export function MetodoPagoCorrectorSheet({
  docId,
  currentMetodoId,
  open,
  onOpenChange,
  onCorrected,
}: MetodoPagoCorrectorSheetProps) {
  const [metodos, setMetodos] = useState<MetodoPago[]>([]);
  const [selected, setSelected] = useState<number | null>(currentMetodoId);
  const { saving, guardar } = useGuardar();

  useEffect(() => {
    if (!open) return;
    setSelected(currentMetodoId);
    apiGet<MetodoPago[]>("/api/metodo-pago")
      .then(setMetodos)
      .catch(() => setMetodos([]));
  }, [open, currentMetodoId]);

  const handleSave = () =>
    guardar(async () => {
      if (!selected) {
        toast.error("Seleccione un método");
        return;
      }
      if (selected === currentMetodoId) {
        onOpenChange(false);
        return;
      }
      try {
        await apiPatch(`/api/documentos/${docId}/metodo-pago`, { IdMetodoPago: selected });
        toast.success("Método de pago corregido");
        onOpenChange(false);
        onCorrected();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al corregir método");
      }
    });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-w-lg mx-auto rounded-t-xl p-0">
        <SheetHeader className="px-4 pt-4">
          <SheetTitle>Corregir método de pago</SheetTitle>
          <SheetDescription>Elige la forma de pago correcta para este documento.</SheetDescription>
        </SheetHeader>

        <div className="flex gap-2 flex-wrap px-4 pt-2">
          {metodos.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelected(m.id)}
              className={cn(
                "text-sm px-4 py-2 rounded-lg font-medium transition-colors",
                selected === m.id
                  ? "bg-brand-surface text-brand-dark ring-1 ring-brand/30"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted",
              )}
            >
              {m.Nombre}
            </button>
          ))}
        </div>

        <div className="p-4">
          <Button
            className="w-full h-12 bg-brand hover:bg-brand-dark text-white font-bold text-base"
            onClick={handleSave}
            disabled={saving || !selected}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
