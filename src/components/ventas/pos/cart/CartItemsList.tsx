"use client";

import { Package, Pencil, Trash2 } from "lucide-react";
import { numToString } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BasketItemLocal } from "@/hooks/pos/use-basket";
import { CantidadInput } from "./CantidadInput";

interface CartItemsListProps {
  items: BasketItemLocal[];
  onUpdateQuantity: (tempId: string, delta: number) => void;
  /** Fija la cantidad exacta (edición inline del input). */
  onSetQuantity: (tempId: string, value: number) => void;
  onRemoveItem: (tempId: string) => void;
  /** Abre el editor de SOLO precio. */
  onEditPrice: (item: BasketItemLocal) => void;
  onClear: () => void;
}

export function CartItemsList({
  items,
  onUpdateQuantity,
  onSetQuantity,
  onRemoveItem,
  onEditPrice,
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

      <div className="rounded-lg bg-white dark:bg-card ring-1 ring-border/50 divide-y divide-border overflow-hidden">
        {items.map((item) => {
          const subtotal = item.Cantidad * item.PrecioVenta;
          return (
            <div key={item._tempId} className="p-3">
              {/* Fila superior: nombre + eliminar */}
              <div className="flex items-center gap-2">
                <span className="flex-1 min-w-0 truncate text-sm font-semibold">
                  {item.Descripcion}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveItem(item._tempId)}
                  aria-label={`Eliminar ${item.Descripcion}`}
                  className="h-7 w-7 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Fila inferior: cantidad (independiente) · precio (independiente) · total */}
              <div className="flex items-center justify-between gap-2 mt-2">
                {/* Cantidad: −/+ rápido + input inline (commit en blur/Enter) */}
                <div className="flex items-center shrink-0">
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(item._tempId, -1)}
                    disabled={item.Cantidad <= 1}
                    aria-label="Disminuir cantidad"
                    className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
                      item.Cantidad <= 1
                        ? "bg-muted/50 text-muted-foreground/40 cursor-not-allowed"
                        : "bg-muted hover:bg-accent text-muted-foreground"
                    )}
                  >
                    −
                  </button>
                  <CantidadInput
                    value={item.Cantidad}
                    onCommit={(v) => onSetQuantity(item._tempId, v)}
                    ariaLabel={`Cantidad de ${item.Descripcion}`}
                  />
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(item._tempId, 1)}
                    aria-label="Aumentar cantidad"
                    className="h-7 w-7 rounded-full bg-muted hover:bg-accent flex items-center justify-center text-sm font-bold text-muted-foreground transition-colors"
                  >
                    +
                  </button>
                </div>

                {/* Precio unitario: botón independiente que abre el editor de precio */}
                <button
                  type="button"
                  onClick={() => onEditPrice(item)}
                  aria-label={`Editar precio de ${item.Descripcion}`}
                  className="flex-1 min-w-0 flex items-center justify-center gap-1 text-xs text-muted-foreground tabular-nums rounded-md py-1 hover:bg-accent transition-colors"
                >
                  <span className="truncate">Precio U. {numToString(item.PrecioVenta)}</span>
                  <Pencil className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                </button>

                {/* Total */}
                <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-dark">
                  {numToString(subtotal)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
