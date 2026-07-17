"use client";

import { useState, useEffect } from "react";
import { numToString } from "@/lib/format";
import { MontoInput } from "@/components/shared/monto-input";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ItemLibre } from "@/hooks/pos/use-basket";
import { PenLine } from "lucide-react";
import { toast } from "sonner";

interface FreeItemSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Agrega el ítem libre a la canasta (siempre como línea nueva). */
  onAdd: (item: ItemLibre) => void;
}

/**
 * Venta libre: ítem sin producto de catálogo (IdProducto = null).
 * Pide descripción, cantidad y precio de una vez; no toca stock ni kardex.
 */
export function FreeItemSheet({ open, onOpenChange, onAdd }: FreeItemSheetProps) {
  const [descripcion, setDescripcion] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [precio, setPrecio] = useState(0);

  // Formulario limpio en cada apertura (cada ítem libre es independiente).
  useEffect(() => {
    if (open) {
      setDescripcion("");
      setCantidad("1");
      setPrecio(0);
    }
  }, [open]);

  const qty = Math.max(1, parseFloat(cantidad) || 1);
  const subtotal = qty * precio;

  const handleAdd = () => {
    if (!descripcion.trim()) {
      toast.error("Descripción es requerida");
      return;
    }
    if (precio <= 0) {
      toast.error("El precio debe ser mayor a 0");
      return;
    }
    onAdd({ Descripcion: descripcion.trim(), Cantidad: qty, PrecioVenta: precio });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-base font-bold flex items-center gap-2">
            <PenLine className="h-4 w-4 text-brand" />
            Ítem libre
          </SheetTitle>
          <SheetDescription className="text-xs">
            Venta sin producto del catálogo; no afecta el stock
          </SheetDescription>
        </SheetHeader>

        <div
          className="flex flex-col gap-4 pt-2 pb-4"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        >
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Descripción *</Label>
            <Input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej. flete, servicio, artículo suelto..."
              autoFocus
              className="h-11"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Cantidad</Label>
              <Input
                type="number"
                inputMode="decimal"
                min={1}
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Precio unitario *</Label>
              <MontoInput
                value={precio}
                onChange={setPrecio}
                ariaLabel="Precio del ítem libre"
                className="h-11 text-lg font-semibold text-foreground"
              />
            </div>
          </div>

          {/* Subtotal — referencia reactiva */}
          <div className="flex justify-between items-center rounded-md bg-brand-surface px-4 py-3">
            <span className="text-sm font-medium text-brand-dark">Subtotal</span>
            <span className="text-lg font-extrabold text-brand-dark tabular-nums">
              {numToString(subtotal)}
            </span>
          </div>

          <Button
            className="w-full h-11 bg-brand hover:bg-brand-dark text-white font-semibold"
            onClick={handleAdd}
            disabled={!descripcion.trim() || precio <= 0}
          >
            Agregar a la canasta
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
