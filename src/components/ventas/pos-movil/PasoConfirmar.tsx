"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { BasketItemLocal } from "@/hooks/pos/use-basket";
import { CartItemsList } from "@/components/ventas/pos/cart/CartItemsList";
import { CartItemEditSheet } from "@/components/ventas/pos/CartItemEditSheet";
import { StickyTotalBar } from "./StickyTotalBar";

interface PasoConfirmarProps {
  items: BasketItemLocal[];
  total: number;
  onUpdateQuantity: (tempId: string, delta: number) => void;
  onSetQuantity: (tempId: string, value: number) => void;
  onUpdatePrice: (tempId: string, price: number) => void;
  onRemoveItem: (tempId: string) => void;
  onClear: () => void;
  onBack: () => void;
  onNext: () => void;
}

/** Paso 2 del wizard móvil: revisar/editar el pedido antes de los datos. */
export function PasoConfirmar({
  items,
  total,
  onUpdateQuantity,
  onSetQuantity,
  onUpdatePrice,
  onRemoveItem,
  onClear,
  onBack,
  onNext,
}: PasoConfirmarProps) {
  // Solo el precio se edita en sheet; la cantidad es inline en la lista.
  const [editItem, setEditItem] = useState<BasketItemLocal | null>(null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
          Volver
        </button>
        <h2 className="text-[17px] font-bold">Confirmar Pedido</h2>
      </div>

      <CartItemsList
        items={items}
        onUpdateQuantity={onUpdateQuantity}
        onSetQuantity={onSetQuantity}
        onRemoveItem={onRemoveItem}
        onEditPrice={setEditItem}
        onClear={onClear}
      />

      {/* Espacio para que la barra fija no tape el último item */}
      <div className="h-28" />

      <CartItemEditSheet
        item={editItem}
        open={editItem !== null}
        onOpenChange={(open) => {
          if (!open) setEditItem(null);
        }}
        onUpdatePrice={onUpdatePrice}
      />

      <StickyTotalBar label="Continuar" total={total} onClick={onNext} />
    </div>
  );
}
