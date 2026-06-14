"use client";

import { useState, useEffect } from "react";
import { numToString } from "@/lib/format";
import { MontoInput } from "@/components/shared/monto-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { BasketItemLocal } from "@/hooks/pos/use-basket";

interface CartItemEditSheetProps {
  item: BasketItemLocal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdatePrice: (tempId: string, price: number) => void;
}

/**
 * Editor del precio unitario del ítem de canasta. La cantidad se edita
 * inline en CartItemsList (CantidadInput); el precio se mantiene en sheet
 * por el formato de moneda y para evitar ediciones accidentales.
 */
export function CartItemEditSheet({
  item,
  open,
  onOpenChange,
  onUpdatePrice,
}: CartItemEditSheetProps) {
  const [precio, setPrecio] = useState(0);

  // Inicializar al abrir o al cambiar de ítem, nunca en cada render.
  useEffect(() => {
    if (item) setPrecio(item.PrecioVenta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?._tempId, open]);

  if (!item) return null;

  const subtotal = item.Cantidad * precio;

  const handleSubmit = () => {
    onUpdatePrice(item._tempId, precio > 0 ? precio : item.PrecioVenta);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-base font-bold">{item.Descripcion}</SheetTitle>
          <SheetDescription className="text-xs">Modifica el precio unitario</SheetDescription>
        </SheetHeader>

        <div
          className="flex flex-col gap-5 pt-2 pb-4"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
          }}
        >
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Precio unitario</Label>
            <MontoInput
              value={precio}
              onChange={setPrecio}
              autoFocus
              ariaLabel={`Precio de ${item.Descripcion}`}
              className="h-11 text-lg font-semibold text-foreground"
            />
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
            onClick={handleSubmit}
          >
            Actualizar precio
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
