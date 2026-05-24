"use client";

import { useState, useEffect } from "react";
import { numToString, formatN2, parseFormatted } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Minus, Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { BasketItemLocal } from "@/hooks/pos/use-basket";

const spinButtonClass =
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

interface CartItemDetailSheetProps {
  item: BasketItemLocal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateQuantity: (tempId: string, delta: number) => void;
  onSetQuantity: (tempId: string, value: number) => void;
  onUpdatePrice: (tempId: string, price: number) => void;
  onRemoveItem: (tempId: string) => void;
}

export function CartItemDetailSheet({
  item,
  open,
  onOpenChange,
  onSetQuantity,
  onUpdatePrice,
  onRemoveItem,
}: CartItemDetailSheetProps) {
  // Estado local desacoplado del padre: el usuario edita libremente sin que
  // cada tecla dispare un re-render del padre que sobreescriba lo escrito.
  const [qtyDisplay, setQtyDisplay] = useState("1");
  const [priceDisplay, setPriceDisplay] = useState("");

  // Inicializar SOLO al cambiar de ítem (su _tempId), nunca en cada render —
  // de lo contrario los campos se resetearían al valor original al editar.
  useEffect(() => {
    if (item) {
      setQtyDisplay(String(item.Cantidad));
      setPriceDisplay(formatN2(item.PrecioVenta));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?._tempId]);

  if (!item) return null;

  // Valores reactivos derivados de lo que el usuario está escribiendo.
  const cantidad = Math.max(1, parseFloat(qtyDisplay) || 1);
  const precio = parseFormatted(priceDisplay);
  const subtotal = cantidad * precio;

  const stepQty = (delta: number) => {
    setQtyDisplay(String(Math.max(1, cantidad + delta)));
  };

  // Único punto de confirmación: vuelca el estado local al padre y cierra.
  const handleSubmit = () => {
    onSetQuantity(item._tempId, cantidad);
    onUpdatePrice(item._tempId, precio > 0 ? precio : item.PrecioVenta);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-base font-bold">{item.Descripcion}</SheetTitle>
          <SheetDescription className="text-xs">
            Modifica la cantidad y el precio
          </SheetDescription>
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
          {/* Cantidad */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Cantidad</Label>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 rounded-full shrink-0"
                onClick={() => stepQty(-1)}
                disabled={cantidad <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={qtyDisplay}
                onChange={(e) => setQtyDisplay(e.target.value)}
                onFocus={(e) => e.target.select()}
                className={`h-11 flex-1 text-center text-[18px] font-bold tabular-nums text-foreground ${spinButtonClass}`}
              />
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 rounded-full shrink-0"
                onClick={() => stepQty(1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Precio unitario */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Precio unitario</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium pointer-events-none">
                $
              </span>
              <Input
                type="text"
                inputMode="decimal"
                value={priceDisplay}
                onChange={(e) => setPriceDisplay(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="h-11 text-lg font-semibold tabular-nums pl-7 text-foreground"
              />
            </div>
          </div>

          {/* Subtotal — reactivo en tiempo real, sin necesitar confirmación */}
          <div className="flex justify-between items-center rounded-md bg-brand-surface px-4 py-3">
            <span className="text-sm font-medium text-brand-dark">Subtotal</span>
            <span className="text-lg font-extrabold text-brand-dark tabular-nums">
              {numToString(subtotal, "N2")}
            </span>
          </div>

          {/* Actualizar — confirma cantidad y precio */}
          <Button
            className="w-full h-11 bg-brand hover:bg-brand-dark text-white font-semibold"
            onClick={handleSubmit}
          >
            Actualizar
          </Button>

          {/* Eliminar */}
          <button
            type="button"
            className="w-full text-sm font-medium text-destructive hover:text-destructive/80 py-2 transition-colors"
            onClick={() => {
              onRemoveItem(item._tempId);
              onOpenChange(false);
            }}
          >
            Eliminar ítem
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
