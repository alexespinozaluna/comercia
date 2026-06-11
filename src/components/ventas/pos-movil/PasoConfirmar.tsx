"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { BasketItemLocal } from "@/hooks/pos/use-basket";
import { CartItemsList } from "@/components/ventas/pos/cart/CartItemsList";
import {
  CartItemEditSheet,
  type CartEditField,
} from "@/components/ventas/pos/CartItemEditSheet";
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
  const [editItem, setEditItem] = useState<BasketItemLocal | null>(null);
  const [editField, setEditField] = useState<CartEditField | null>(null);

  const openEditor = (item: BasketItemLocal, field: CartEditField) => {
    setEditItem(item);
    setEditField(field);
  };

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
        <h2 className="text-[17px] font-bold">Confirmar pedido</h2>
      </div>

      <CartItemsList
        items={items}
        onUpdateQuantity={onUpdateQuantity}
        onRemoveItem={onRemoveItem}
        onEditQuantity={(item) => openEditor(item, "cantidad")}
        onEditPrice={(item) => openEditor(item, "precio")}
        onClear={onClear}
      />

      {/* Espacio para que la barra fija no tape el último item */}
      <div className="h-28" />

      <CartItemEditSheet
        item={editItem}
        field={editField}
        open={editItem !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditItem(null);
            setEditField(null);
          }
        }}
        onSetQuantity={onSetQuantity}
        onUpdatePrice={onUpdatePrice}
      />

      <StickyTotalBar label="Continuar" total={total} onClick={onNext} />
    </div>
  );
}
