"use client";

import { ReactNode, useState } from "react";
import { Lock } from "lucide-react";
import { useGuardar } from "@/hooks/use-guardar";
import { MetodoPago } from "@/types/database";
import { BasketItemLocal } from "@/hooks/pos/use-basket";
import { CartItemEditSheet } from "./CartItemEditSheet";
import { CartItemsList } from "./cart/CartItemsList";
import { FormaVentaToggle } from "./cart/FormaVentaToggle";
import { FormaPagoChips } from "./cart/FormaPagoChips";
import { FormaPagoDeuda } from "./cart/FormaPagoDeuda";
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
  onSave: () => Promise<void> | void;
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
  // Solo el precio se edita en sheet; la cantidad es inline en la lista.
  const [editItem, setEditItem] = useState<BasketItemLocal | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { saving, guardar } = useGuardar();

  const openEditor = (item: BasketItemLocal) => {
    setEditItem(item);
    setDetailOpen(true);
  };

  // Si el guardado falla (stock, caja cerrada), el finally del hook libera el
  // botón; antes `saving` quedaba en true y el botón inutilizado.
  const handleSave = () => guardar(async () => {
    await onSave();
  });

  const handleVaciar = () => {
    basket.forEach((item) => onRemoveItem(item._tempId));
  };

  return (
    <>
      <div className="space-y-5 pb-28">
        <CartItemsList
          items={basket}
          onUpdateQuantity={onUpdateQuantity}
          onSetQuantity={onSetQuantity}
          onRemoveItem={onRemoveItem}
          onEditPrice={openEditor}
          onClear={handleVaciar}
        />

        <FormaVentaToggle isCredit={isCredit} onChange={onIsCreditChange} />

        {/* Forma de pago: en venta pagada se elige; en deuda queda fija en "Deuda". */}
        {isCredit ? (
          <FormaPagoDeuda />
        ) : (
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
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdatePrice={onUpdatePrice}
      />
    </>
  );
}
