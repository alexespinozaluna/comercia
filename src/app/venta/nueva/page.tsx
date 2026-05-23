"use client";

import { useState } from "react";
import { usePosTransaction } from "@/hooks/use-pos-transaction";
import { LoadingState } from "@/components/shared/loading-state";
import { ProductSearch } from "@/components/ventas/pos/ProductSearch";
import { ProductQuickCreate } from "@/components/ventas/pos/ProductQuickCreate";
import { CartSummary } from "@/components/ventas/pos/CartSummary";
import { ClientSelector } from "@/components/ventas/pos/ClientSelector";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ShoppingCart } from "lucide-react";

export default function VentaNuevaPage() {
  const [cartOpen, setCartOpen] = useState(false);
  const [productSheetOpen, setProductSheetOpen] = useState(false);

  const pos = usePosTransaction(Promise.resolve({ id: "0" }));

  if (pos.loading) {
    return <LoadingState variant="skeleton-cards" count={6} />;
  }

  if (pos.redirectTo) {
    return null;
  }

  const cartContent = (onSaveExtra?: () => void) => (
    <CartSummary
      basket={pos.basket}
      total={pos.total}
      fecha={pos.fecha}
      isCredit={pos.isCredit}
      cajaAbierta={pos.cajaAbierta}
      isEdit={pos.isEdit}
      canSave={pos.canSave}
      descripcion={pos.descripcion}
      concepto={pos.concepto}
      onFechaChange={pos.setFecha}
      onIsCreditChange={pos.setIsCredit}
      onUpdateQuantity={pos.updateQuantity}
      onSetQuantity={pos.setQuantity}
      onUpdatePrice={pos.updatePrice}
      onRemoveItem={pos.removeFromBasket}
      onConceptoChange={pos.handleConceptoChange}
      onClearConcepto={pos.clearConceptoManual}
      onSave={() => {
        onSaveExtra?.();
        pos.handleSave();
      }}
      inSheet
    >
      <ClientSelector
        selectedClientId={pos.selectedClientId}
        selectedClientName={pos.selectedClientName}
        selectedDireccionId={pos.selectedDireccionId}
        direcciones={pos.direcciones}
        onSelectClient={pos.handleSelectClient}
        onRemoveClient={pos.removeClient}
        onDireccionChange={pos.setSelectedDireccionId}
      />
    </CartSummary>
  );

  return (
    <>
      <div className="flex gap-4">
        {/* Product grid — full width on mobile, flex-1 on desktop */}
        <div className="flex-1 min-w-0 space-y-4 pb-24 md:pb-4">
          <ProductSearch
            products={pos.filteredProducts}
            search={pos.search}
            onSearchChange={pos.setSearch}
            basket={pos.basket}
            onAddProduct={pos.addToBasket}
            onQuickCreate={() => setProductSheetOpen(true)}
            total={pos.total}
            itemCount={pos.basket.length}
            onViewCart={() => setCartOpen(true)}
          />
        </div>

        {/* Cart sidebar — desktop only */}
        <aside className="hidden md:flex md:flex-col md:w-[380px] md:shrink-0 md:sticky md:top-4 md:self-start md:max-h-[calc(100vh-5rem)] bg-white dark:bg-card rounded-lg ring-1 ring-border/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2 shrink-0">
            <ShoppingCart className="h-4 w-4 text-brand" />
            <span className="text-sm font-semibold text-foreground">Canasta</span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pt-3">
            {cartContent()}
          </div>
        </aside>
      </div>

      {/* Cart Sheet — mobile only, opened from FAB */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto md:hidden">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Canasta
            </SheetTitle>
            <SheetDescription>
              Toca un producto para editar cantidad y precio
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pt-2">
            {cartContent(() => setCartOpen(false))}
          </div>
        </SheetContent>
      </Sheet>

      <ProductQuickCreate
        open={productSheetOpen}
        onOpenChange={setProductSheetOpen}
        onProductCreated={pos.addProductToList}
      />
    </>
  );
}