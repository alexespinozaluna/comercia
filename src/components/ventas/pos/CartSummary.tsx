"use client";

import { ReactNode, useState } from "react";
import { Lock } from "lucide-react";
import { MetodoPago } from "@/types/database";
import { BasketItemLocal } from "@/hooks/pos/use-basket";
import { CartItemEditSheet, type CartEditField } from "./CartItemEditSheet";
import { CartItemsList } from "./cart/CartItemsList";
import { FormaVentaToggle } from "./cart/FormaVentaToggle";
import { FormaPagoChips } from "./cart/FormaPagoChips";
import { FechaSection } from "./cart/FechaSection";
import { NotasSection } from "./cart/NotasSection";
import { CartBottomBar } from "./cart/CartBottomBar";
import { SectionLabel } from "./cart/SectionLabel";

interface CartSummaryProps {
  basket: BasketItemLocal[];
  total: number;
  fecha: string;
  isCredit: boolean;
  cajaAbierta: boolean | null;
  isEdit: boolean;
  canSave: boolean;
  descripcion: string;
  concepto: string;
  metodosPago: MetodoPago[];
  selectedIdMetodoPago: number | null;
  onFechaChange: (fecha: string) => void;
  onIsCreditChange: (isCredit: boolean) => void;
  onIdMetodoPagoChange: (id: number | null) => void;
  onUpdateQuantity: (tempId: string, delta: number) => void;
  onSetQuantity: (tempId: string, value: number) => void;
  onUpdatePrice: (tempId: string, price: number) => void;
  onRemoveItem: (tempId: string) => void;
  onConceptoChange: (value: string) => void;
  onClearConcepto: () => void;
  onSave: () => void;
  /** ClientSelector (passed in by PosShell since it needs router hooks). */
  children: ReactNode;
}

/**
 * Composer for the cart panel — orchestrates the focused subcomponents.
 * Owns only the local UI state for the item-detail sheet + saving spinner.
 */
export function CartSummary({
  basket,
  total,
  fecha,
  isCredit,
  cajaAbierta,
  isEdit,
  canSave,
  descripcion,
  concepto,
  metodosPago,
  selectedIdMetodoPago,
  onFechaChange,
  onIsCreditChange,
  onIdMetodoPagoChange,
  onUpdateQuantity,
  onSetQuantity,
  onUpdatePrice,
  onRemoveItem,
  onConceptoChange,
  onClearConcepto,
  onSave,
  children,
}: CartSummaryProps) {
  const [editItem, setEditItem] = useState<BasketItemLocal | null>(null);
  const [editField, setEditField] = useState<CartEditField | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const openEditor = (item: BasketItemLocal, field: CartEditField) => {
    setEditItem(item);
    setEditField(field);
    setDetailOpen(true);
  };

  const handleSave = () => {
    if (saving) return;
    setSaving(true);
    onSave();
  };

  const handleVaciar = () => {
    basket.forEach((item) => onRemoveItem(item._tempId));
  };

  return (
    <>
      <div className="space-y-5 pb-28">
        <CartItemsList
          items={basket}
          onUpdateQuantity={onUpdateQuantity}
          onRemoveItem={onRemoveItem}
          onEditQuantity={(item) => openEditor(item, "cantidad")}
          onEditPrice={(item) => openEditor(item, "precio")}
          onClear={handleVaciar}
        />

        <FormaVentaToggle isCredit={isCredit} onChange={onIsCreditChange} />

        {/* Forma de pago: solo aplica a ventas de contado; en crédito no se muestra. */}
        {!isCredit && (
          <FormaPagoChips
            metodos={metodosPago}
            selectedId={selectedIdMetodoPago}
            onChange={onIdMetodoPagoChange}
          />
        )}

        {/* Cliente — siempre visible (no depende de forma de venta) */}
        <div className="space-y-2">
          <SectionLabel>Cliente</SectionLabel>
          {children}
        </div>

        <FechaSection fecha={fecha} onChange={onFechaChange} />

        <NotasSection
          concepto={concepto}
          autoDescripcion={descripcion}
          onChange={onConceptoChange}
          onClear={onClearConcepto}
        />

        {cajaAbierta === false && (
          <div className="rounded-md border bg-warning/10 border-warning/20 p-3 text-xs flex items-center gap-2">
            <Lock className="h-4 w-4 text-warning shrink-0" />
            <span>Debe abrir la caja para registrar ventas.</span>
          </div>
        )}
      </div>

      <CartBottomBar
        total={total}
        saving={saving}
        canSave={canSave}
        isEdit={isEdit}
        onSave={handleSave}
      />

      <CartItemEditSheet
        item={editItem}
        field={editField}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onSetQuantity={onSetQuantity}
        onUpdatePrice={onUpdatePrice}
      />
    </>
  );
}
