"use client";

import { useState, useCallback, useEffect } from "react";
import { numToString } from "@/lib/format";
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
import { BasketItemLocal } from "@/hooks/use-pos-transaction";

function formatN2(value: number): string {
  return value.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseFormatted(raw: string): number {
  const cleaned = raw.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

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
  onUpdateQuantity,
  onSetQuantity,
  onUpdatePrice,
  onRemoveItem,
}: CartItemDetailSheetProps) {
  const [priceDisplay, setPriceDisplay] = useState("");
  const [priceFocused, setPriceFocused] = useState(false);
  const [qtyDisplay, setQtyDisplay] = useState("");

  useEffect(() => {
    if (item) {
      if (!priceFocused) setPriceDisplay(formatN2(item.PrecioVenta));
      setQtyDisplay(String(item.Cantidad));
    }
  }, [item?.PrecioVenta, item?.Cantidad, item?._tempId, priceFocused]);

  const handlePriceFocus = useCallback(() => {
    if (!item) return;
    setPriceFocused(true);
    setPriceDisplay(String(item.PrecioVenta));
  }, [item]);

  const handlePriceBlur = useCallback(() => {
    setPriceFocused(false);
    if (!item) return;
    const parsed = parseFormatted(priceDisplay);
    const finalPrice = parsed > 0 ? parsed : item.PrecioVenta;
    onUpdatePrice(item._tempId, finalPrice);
    setPriceDisplay(formatN2(finalPrice));
  }, [priceDisplay, item, onUpdatePrice]);

  const handlePriceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!item) return;
      setPriceDisplay(e.target.value);
      const parsed = parseFormatted(e.target.value);
      if (parsed > 0) onUpdatePrice(item._tempId, parsed);
    },
    [item, onUpdatePrice]
  );

  const handleQtyBlur = useCallback(() => {
    if (!item) return;
    const v = parseInt(qtyDisplay);
    if (isNaN(v) || v < 1) {
      onSetQuantity(item._tempId, 1);
      setQtyDisplay("1");
    }
  }, [qtyDisplay, item, onSetQuantity]);

  if (!item) return null;

  const subtotal = item.Cantidad * item.PrecioVenta;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-base font-bold">{item.Descripcion}</SheetTitle>
          <SheetDescription className="text-xs">
            Modifica la cantidad y el precio
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 pt-2 pb-4">
          {/* Cantidad */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Cantidad</Label>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 rounded-full shrink-0"
                onClick={() => {
                  onUpdateQuantity(item._tempId, -1);
                  setQtyDisplay(String(Math.max(1, item.Cantidad - 1)));
                }}
                disabled={item.Cantidad <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={qtyDisplay}
                onChange={(e) => {
                  setQtyDisplay(e.target.value);
                  const v = parseInt(e.target.value);
                  if (!isNaN(v) && v >= 1) onSetQuantity(item._tempId, v);
                }}
                onFocus={(e) => e.target.select()}
                onBlur={handleQtyBlur}
                className={`h-11 flex-1 text-center text-[18px] font-bold tabular-nums ${spinButtonClass}`}
              />
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 rounded-full shrink-0"
                onClick={() => {
                  onUpdateQuantity(item._tempId, 1);
                  setQtyDisplay(String(item.Cantidad + 1));
                }}
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
                value={priceFocused ? priceDisplay : formatN2(item.PrecioVenta)}
                onChange={handlePriceChange}
                onFocus={handlePriceFocus}
                onBlur={handlePriceBlur}
                className="h-11 text-lg font-semibold tabular-nums pl-7"
              />
            </div>
          </div>

          {/* Subtotal */}
          <div className="flex justify-between items-center rounded-md bg-brand-surface px-4 py-3">
            <span className="text-sm font-medium text-brand-dark">Subtotal</span>
            <span className="text-lg font-extrabold text-brand-dark tabular-nums">
              {numToString(subtotal, "N2")}
            </span>
          </div>

          {/* Actualizar */}
          <Button
            className="w-full h-11 bg-brand hover:bg-brand-dark text-white font-semibold"
            onClick={() => onOpenChange(false)}
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
