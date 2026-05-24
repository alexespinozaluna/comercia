"use client";

import { Package, Pencil, Trash2 } from "lucide-react";
import { numToString } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BasketItemLocal } from "@/hooks/pos/use-basket";

interface CartItemsListProps {
  items: BasketItemLocal[];
  onUpdateQuantity: (tempId: string, delta: number) => void;
  onRemoveItem: (tempId: string) => void;
  onTapItem: (item: BasketItemLocal) => void;
  onClear: () => void;
}

export function CartItemsList({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onTapItem,
  onClear,
}: CartItemsListProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <Package className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-sm">La canasta está vacía</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {items.length} producto{items.length !== 1 ? "s" : ""}
        </span>
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-medium text-destructive hover:text-destructive/80 transition-colors"
        >
          Vaciar
        </button>
      </div>

      <div className="rounded-md bg-white dark:bg-card ring-1 ring-border/50 divide-y divide-border overflow-hidden">
        {items.map((item) => {
          const subtotal = item.Cantidad * item.PrecioVenta;
          return (
            <div
              key={item._tempId}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/30 transition-colors cursor-pointer"
              onClick={() => onTapItem(item)}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{item.Descripcion}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {item.Cantidad} × {numToString(item.PrecioVenta)}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Inline quantity controls */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onUpdateQuantity(item._tempId, -1); }}
                    disabled={item.Cantidad <= 1}
                    className={cn(
                      "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                      item.Cantidad <= 1
                        ? "bg-muted/50 text-muted-foreground/40 cursor-not-allowed"
                        : "bg-muted hover:bg-accent text-muted-foreground"
                    )}
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-xs font-bold tabular-nums">
                    {item.Cantidad}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onUpdateQuantity(item._tempId, 1); }}
                    className="h-6 w-6 rounded-full bg-muted hover:bg-accent flex items-center justify-center text-xs font-bold text-muted-foreground transition-colors"
                  >
                    +
                  </button>
                </div>
                <span className="text-sm font-bold tabular-nums text-foreground min-w-[4rem] text-right">
                  {numToString(subtotal)}
                </span>
                <Pencil className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemoveItem(item._tempId); }}
                  aria-label={`Eliminar ${item.Descripcion}`}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
