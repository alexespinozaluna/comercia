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

/** Campo que edita el sheet. Cada uno es totalmente independiente del otro. */
export type CartEditField = "cantidad" | "precio";

interface CartItemEditSheetProps {
  item: BasketItemLocal | null;
  /** Qué campo se está editando; null cuando el sheet está cerrado. */
  field: CartEditField | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetQuantity: (tempId: string, value: number) => void;
  onUpdatePrice: (tempId: string, price: number) => void;
}

/**
 * Editor de UN solo campo (cantidad O precio) del ítem de canasta.
 * Mantener cada campo en su propio sheet evita que, al editar la cantidad,
 * el usuario altere el precio por error (y viceversa).
 */
export function CartItemEditSheet({
  item,
  field,
  open,
  onOpenChange,
  onSetQuantity,
  onUpdatePrice,
}: CartItemEditSheetProps) {
  const [valor, setValor] = useState("");

  // Inicializar al abrir o al cambiar de ítem/campo, nunca en cada render.
  useEffect(() => {
    if (item && field === "cantidad") setValor(String(item.Cantidad));
    else if (item && field === "precio") setValor(formatN2(item.PrecioVenta));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?._tempId, field, open]);

  if (!item || !field) return null;

  const esCantidad = field === "cantidad";
  const cantidad = esCantidad ? Math.max(1, parseFloat(valor) || 1) : item.Cantidad;
  const precio = esCantidad ? item.PrecioVenta : parseFormatted(valor);
  const subtotal = cantidad * precio;

  const stepQty = (delta: number) => setValor(String(Math.max(1, cantidad + delta)));

  const handleSubmit = () => {
    if (esCantidad) {
      onSetQuantity(item._tempId, cantidad);
    } else {
      onUpdatePrice(item._tempId, precio > 0 ? precio : item.PrecioVenta);
    }
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-base font-bold">{item.Descripcion}</SheetTitle>
          <SheetDescription className="text-xs">
            {esCantidad ? "Modifica la cantidad" : "Modifica el precio unitario"}
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
          {esCantidad ? (
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
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  autoFocus
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
          ) : (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Precio unitario</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium pointer-events-none">
                  $
                </span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  autoFocus
                  className="h-11 text-lg font-semibold tabular-nums pl-7 text-foreground"
                />
              </div>
            </div>
          )}

          {/* Subtotal — referencia reactiva */}
          <div className="flex justify-between items-center rounded-md bg-brand-surface px-4 py-3">
            <span className="text-sm font-medium text-brand-dark">Subtotal</span>
            <span className="text-lg font-extrabold text-brand-dark tabular-nums">
              {numToString(subtotal, "N2")}
            </span>
          </div>

          <Button
            className="w-full h-11 bg-brand hover:bg-brand-dark text-white font-semibold"
            onClick={handleSubmit}
          >
            Actualizar {esCantidad ? "cantidad" : "precio"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
